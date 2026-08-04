#!/usr/bin/env python3
"""Presence-only validator for a repository's pull-request metadata contract.

The contract is not written in this file. It is *derived* from the repository's
own `.github/PULL_REQUEST_TEMPLATE.md`: every `## Heading` and every top-level
`Label:` declaration in the template becomes a required, must-be-answered field.

That indirection is the point. The obvious alternative — a hardcoded
`REQUIRED_FIELDS` list — makes the template and the validator two copies of one
contract, so they can drift: a field is added to the template and never
enforced, or enforced after being dropped from the template. Repositories that
took that route need a third artifact (a guard test asserting the two agree) to
hold the copies together. Deriving the contract removes the second copy, so
there is nothing left to drift.

What this validator deliberately does NOT do: judge whether an answer is *true*.
Nothing in a repository knows what was originally requested, only what was
delivered, so "did this PR honestly disclose what it cut" is not machine-
decidable. Presence is. A body that never mentions scope at all is exactly the
undisclosed-partial case, and requiring the field routes it to a reviewer who
can tell the difference. See `docs/engineering-os/quality-gate-design.md`
("Give a self-declared field a consequence someone sees") and
`docs/engineering-os/scope-completeness.md`.

Security note: this validator must read the template from the BASE branch, never
from the pull-request head. A gate that derives its contract from the branch
under review can be disabled by the change under review — deleting a section
from the template in the same PR would silently retire the requirement. The
shipped workflow uses `pull_request_target`, which checks out the base, for
exactly this reason.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os
import pathlib
import re
import sys

# Template guidance is written in HTML comments, which are not answers. They are
# stripped before any emptiness test so that a section containing only the
# template's own instructions counts as unanswered. An unclosed `<!--` runs to
# end of text, matching how GitHub renders one.
COMMENT_RE = re.compile(r"<!--.*?(?:-->|\Z)", re.S)

HEADING_RE = re.compile(r"(?m)^##[ \t]+(?P<heading>\S.*?)[ \t]*$")

# Markdown code regions, masked before comment detection so that documentation
# *about* HTML comments (this validator's own PR body mentions `<!--` several
# times) is not mistaken for a comment. Fenced blocks first, then inline spans.
CODE_REGION_RE = re.compile(
    r"(?ms)^[ \t]*(?P<fence>```+|~~~+).*?(?:^[ \t]*(?P=fence)[ \t]*$|\Z)"
    r"|(?P<tick>`+)(?:(?!(?P=tick)).)*?(?P=tick)",
)

# A declaration is a top-level `Label: value` line above the first heading, e.g.
# `Touches hot-path: yes | no`. Bounded label length keeps ordinary prose
# containing a colon from being parsed as a contract field.
DECLARATION_RE = re.compile(r"^(?P<label>[^:\r\n]{1,60}?):[ \t]*(?P<value>.*)$")

# A section or declaration marked with this opts out of enforcement. Adopting
# repositories use it for fields they want to prompt for but not require.
OPTIONAL_MARKER = "eos:optional"

# Bare non-answers. An explained not-applicable ("N/A — no UI surface") passes;
# a lone "N/A" does not, because it carries no information a reviewer can act on.
PLACEHOLDER_RE = re.compile(
    r"^(?:n/?a|not applicable|none|nothing|tbd|todo|\?+|[-–—_.]+|\.{2,}|…+|<[^>]*>)$",
    re.IGNORECASE,
)

TEMPLATE_CANDIDATES = (
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE/default.md",
    "docs/PULL_REQUEST_TEMPLATE.md",
    "PULL_REQUEST_TEMPLATE.md",
)

RULE_REFERENCES = (
    "docs/engineering-os/pr-quality.md",
    "docs/engineering-os/scope-completeness.md",
    "docs/engineering-os/quality-gate-design.md",
)


@dataclasses.dataclass(frozen=True)
class Declaration:
    label: str
    template_value: str
    required: bool


@dataclasses.dataclass(frozen=True)
class Section:
    heading: str
    template_body: str
    required: bool


@dataclasses.dataclass(frozen=True)
class Contract:
    declarations: tuple[Declaration, ...]
    sections: tuple[Section, ...]

    @property
    def required_sections(self) -> tuple[Section, ...]:
        return tuple(section for section in self.sections if section.required)

    @property
    def required_declarations(self) -> tuple[Declaration, ...]:
        return tuple(declaration for declaration in self.declarations if declaration.required)


def _comment_spans(text: str) -> list[tuple[int, int]]:
    """Character ranges of the HTML comments in `text`, ignoring ones quoted in
    markdown code.

    Code spans and fenced blocks are masked (length-preservingly) before the
    search. A PR body that *documents* HTML comments quotes the opening delimiter
    in backticks — this validator's own does — and treating that quote as a real
    comment start would swallow the rest of the body, reporting every section
    after it as missing.

    An unterminated `<!--` outside code runs to end of text: a template whose
    comment is never closed has all of its remaining prose commented out as far
    as GitHub is concerned, so the gate must read it the same way.
    """

    def blank(match: re.Match[str]) -> str:
        return "".join("\n" if char == "\n" else " " for char in match.group(0))

    masked = CODE_REGION_RE.sub(blank, text or "")
    return [match.span() for match in COMMENT_RE.finditer(masked)]


def strip_comments(text: str) -> str:
    """Delete HTML comments, keeping code spans and fenced blocks intact.

    Template guidance lives in comments and is not an answer, so it is removed
    before any emptiness test.
    """
    text = text or ""
    spans = _comment_spans(text)
    if not spans:
        return text
    kept: list[str] = []
    cursor = 0
    for start, end in spans:
        kept.append(text[cursor:start])
        cursor = end
    kept.append(text[cursor:])
    return "".join(kept)


def _blank_comment_spans(text: str) -> str:
    """Same removal as `strip_comments`, but padded so the result has identical
    length and line numbering to the input.

    Two callers need offsets to survive: `_split_blocks` finds headings here and
    slices bodies out of the raw text, and `_parse_declarations` walks raw and
    blanked lines in lockstep. Both rely on that to keep each block's
    `eos:optional` marker — which lives inside a comment — attached to the block
    it applies to.
    """
    text = text or ""
    spans = _comment_spans(text)
    if not spans:
        return text
    result = list(text)
    for start, end in spans:
        for index in range(start, end):
            if result[index] != "\n":
                result[index] = " "
    return "".join(result)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", strip_comments(text)).strip()


def _offered_choices(template_default: str) -> set[str]:
    """The alternatives a `Label: a | b | c` template line offers the author.

    A word this template explicitly lists is an answer even when it reads like a
    placeholder. `Data egress impact: none | local-only | network-content` makes
    `none` the correct answer for a docs change, so the placeholder filter must
    not reject it — the author picked from the menu the repo wrote.
    """
    default = normalize(template_default)
    if "|" not in default:
        return set()
    return {choice.strip().casefold() for choice in default.split("|") if choice.strip()}


def is_answered(value: str, template_default: str = "") -> bool:
    """True when `value` carries content the template did not already supply.

    Three ways to be unanswered: empty after comment-stripping, a bare
    placeholder, or byte-for-byte the template's own default (the author left
    the choice list or guidance prose in place).
    """
    normalized = normalize(value)
    if not normalized:
        return False
    default = normalize(template_default)
    if default and normalized.casefold() == default.casefold():
        return False
    # An explicitly offered choice outranks the placeholder filter: picking one
    # is the intended way to answer, whatever the word happens to be.
    if normalized.casefold() in _offered_choices(template_default):
        return True
    if PLACEHOLDER_RE.fullmatch(normalized):
        return False
    return True


def _split_blocks(text: str) -> tuple[str, list[tuple[str, str]]]:
    """Split raw markdown into (preamble, [(heading, raw_body), ...]).

    Headings are located on comment-blanked text so that a `## Heading` quoted
    inside an instructional `<!-- ... -->` block is not mistaken for a real
    section. Offsets are preserved by the blanking, so bodies are still sliced
    out of the RAW text — that keeps each block's `eos:optional` marker attached
    to the block it applies to.
    """
    searchable = _blank_comment_spans(text)
    matches = list(HEADING_RE.finditer(searchable))
    if not matches:
        return (text or ""), []
    preamble = (text or "")[: matches[0].start()]
    blocks: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text or "")
        blocks.append((match.group("heading"), (text or "")[match.end() : end]))
    return preamble, blocks


def _parse_declarations(preamble: str) -> list[tuple[str, str, bool]]:
    parsed: list[tuple[str, str, bool]] = []
    # Comment removal has to happen on the whole preamble, not per line: real
    # templates open a `<!--` on one line and close it many lines later, and the
    # prose in between is full of `Label: value`-shaped text ("MACHINE-CHECKED
    # by ...:", "See ...:"). Stripping per line leaves those lines intact and
    # the gate would demand them as required fields. Blanking the comment span
    # while preserving line count keeps the optional-marker lookup below aligned
    # with the original lines.
    stripped_lines = _blank_comment_spans(preamble).splitlines()
    for raw_line, line in zip(preamble.splitlines(), stripped_lines):
        optional = OPTIONAL_MARKER in raw_line
        line = line.strip()
        if not line or line.startswith("#") or line.startswith(">") or line.startswith("-"):
            continue
        match = DECLARATION_RE.match(line)
        if match is None:
            continue
        label = match.group("label").strip()
        if not label:
            continue
        parsed.append((label, match.group("value").strip(), optional))
    return parsed


def parse_template(text: str) -> Contract:
    preamble, blocks = _split_blocks(text)
    declarations = tuple(
        Declaration(label=label, template_value=value, required=not optional)
        for label, value, optional in _parse_declarations(preamble)
    )
    sections = tuple(
        Section(
            heading=heading,
            template_body=body,
            required=OPTIONAL_MARKER not in body and OPTIONAL_MARKER not in heading,
        )
        for heading, body in blocks
    )
    return Contract(declarations=declarations, sections=sections)


def _body_sections(body: str) -> dict[str, str]:
    _, blocks = _split_blocks(body)
    found: dict[str, str] = {}
    for heading, raw_body in blocks:
        # A duplicated heading concatenates rather than overwrites, so a stray
        # second copy cannot blank out a filled-in first one.
        key = normalize(heading).casefold()
        found[key] = f"{found.get(key, '')}\n{raw_body}" if key in found else raw_body
    return found


def _body_declarations(body: str) -> dict[str, str]:
    preamble, _ = _split_blocks(body)
    found: dict[str, str] = {}
    for label, value, _optional in _parse_declarations(preamble):
        found.setdefault(normalize(label).casefold(), value)
    return found


def validate_body(body: str, contract: Contract, *, min_sections: int = 2) -> list[str]:
    """Return human-readable errors; an empty list means the body satisfies the contract."""
    errors: list[str] = []

    # Fail closed on an empty contract. A gutted or unparseable template would
    # otherwise make every PR pass vacuously — the failure mode that looks
    # exactly like success. Same discipline structural guards use: prove the
    # scan found something before trusting a clean result.
    if len(contract.required_sections) < min_sections:
        return [
            f"PR template contract looks empty: derived only {len(contract.required_sections)} required "
            f"section(s), expected at least {min_sections}. The template was probably gutted, moved, or "
            "is being read from the wrong path — a vacuous pass is worse than no gate. "
            "Check `.github/PULL_REQUEST_TEMPLATE.md` on the base branch."
        ]

    if not normalize(body):
        return [
            "PR body is empty. Fill in the repository's pull-request template: "
            + ", ".join(f"`## {section.heading}`" for section in contract.required_sections)
        ]

    present_sections = _body_sections(body)
    for section in contract.required_sections:
        key = normalize(section.heading).casefold()
        if key not in present_sections:
            errors.append(f"PR body is missing required section `## {section.heading}`.")
        elif not is_answered(present_sections[key], section.template_body):
            errors.append(
                f"`## {section.heading}` is empty. Replace the template's guidance with a concrete "
                "answer, or an explained not-applicable reason."
            )

    present_declarations = _body_declarations(body)
    for declaration in contract.required_declarations:
        key = normalize(declaration.label).casefold()
        if key not in present_declarations:
            errors.append(f"PR body is missing required declaration `{declaration.label}:`.")
        elif not is_answered(present_declarations[key], declaration.template_value):
            errors.append(
                f"Declaration `{declaration.label}:` is unanswered. Choose a value instead of leaving "
                "the template's placeholder in place."
            )

    return list(dict.fromkeys(errors))


def resolve_case_insensitively(path: pathlib.Path) -> pathlib.Path | None:
    """`path` as it is actually spelled on disk, or None if nothing matches it.

    GitHub matches the PR-template filename case-insensitively, so
    `.github/Pull_Request_Template.md` is a template GitHub honours. A plain
    `path.exists()` search agrees on a case-insensitive macOS or Windows checkout
    and disagrees on the case-sensitive Linux runner that actually executes this
    gate — where the gate would block every PR with "no template found" while the
    template sits right there. Failing closed is correct for a GUTTED template,
    not for one the search spelled wrong.

    The directory listing is scanned even when `path.exists()` is true, because on
    a case-insensitive filesystem that call answers "is something at this name"
    and yields back the name we asked about rather than the file's real one. The
    real one is what gets printed in `--print-contract` and in every failure
    report, so an author sent to the wrong spelling goes looking for a file that
    does not exist. The exact spelling still wins when both are present.
    """
    parent = path.parent
    if not parent.is_dir():
        return None
    wanted = path.name.casefold()
    fallback: pathlib.Path | None = None
    for entry in sorted(parent.iterdir()):
        if not entry.is_file():
            continue
        if entry.name == path.name:
            return entry
        if entry.name.casefold() == wanted and fallback is None:
            fallback = entry
    return fallback


def find_template(repo_root: pathlib.Path, explicit: pathlib.Path | None = None) -> pathlib.Path:
    if explicit is not None:
        if not explicit.exists():
            raise SystemExit(f"PR template not found at {explicit}")
        return explicit
    # Candidate order is the contract: a repository holding two spellings keeps
    # deriving its contract from the same file it always did.
    for candidate in TEMPLATE_CANDIDATES:
        resolved = resolve_case_insensitively(repo_root / candidate)
        if resolved is not None:
            return resolved
    raise SystemExit(
        "No pull-request template found. This gate derives its contract from the template, so it "
        "cannot run without one. Install the `pr-template` module first: searched "
        + ", ".join(TEMPLATE_CANDIDATES)
    )


def load_event_body(path: pathlib.Path) -> str:
    payload = json.loads(path.read_text(encoding="utf-8"))
    pull_request = payload.get("pull_request") or {}
    return str(pull_request.get("body") or "")


def escape_annotation(value: str) -> str:
    return value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def report(errors: list[str], *, template_path: str) -> None:
    print("PR metadata policy failed:\n")
    for error in errors:
        print(f"::error title=PR metadata policy::{escape_annotation(error)}")
        print(f"- {error}")
    print(f"\nThe contract above is derived from `{template_path}` on the base branch.")
    print("Required reading before editing the PR again:")
    for reference in RULE_REFERENCES:
        print(f"- {reference}")
    print("\nFix the PR body. The `edited` event re-runs this check automatically.")

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        lines = ["## PR metadata policy failed", "", "### Problems"]
        lines.extend(f"- {error}" for error in errors)
        lines.extend(["", f"Contract derived from `{template_path}` (base branch).", "", "### Required reading"])
        lines.extend(f"- `{reference}`" for reference in RULE_REFERENCES)
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo-root", type=pathlib.Path, default=pathlib.Path("."))
    parser.add_argument("--template", type=pathlib.Path, help="override template path (default: auto-detect)")
    parser.add_argument("--event", type=pathlib.Path, help="GitHub event payload JSON to read the body from")
    parser.add_argument("--body", help="PR body text (default: $PR_BODY)")
    parser.add_argument("--body-file", type=pathlib.Path, help="file containing the PR body")
    parser.add_argument(
        "--min-sections",
        type=int,
        default=2,
        help="sentinel floor: fail if the template yields fewer required sections (default: 2)",
    )
    parser.add_argument("--print-contract", action="store_true", help="print the derived contract and exit")
    args = parser.parse_args(argv)

    template_path = find_template(args.repo_root, args.template)
    contract = parse_template(template_path.read_text(encoding="utf-8"))

    if args.print_contract:
        print(f"contract derived from {template_path}")
        for declaration in contract.declarations:
            flag = "required" if declaration.required else "optional"
            print(f"  declaration [{flag}] {declaration.label}")
        for section in contract.sections:
            flag = "required" if section.required else "optional"
            print(f"  section     [{flag}] ## {section.heading}")
        return 0

    if args.event:
        body = load_event_body(args.event)
    elif args.body_file:
        body = args.body_file.read_text(encoding="utf-8")
    elif args.body is not None:
        body = args.body
    else:
        body = os.environ.get("PR_BODY", "")

    errors = validate_body(body, contract, min_sections=args.min_sections)
    if errors:
        report(errors, template_path=str(template_path))
        return 1
    print(f"PR metadata policy passed ({len(contract.required_sections)} required sections checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
