# GEP: Genome Evolution Protocol

**Version:** 1.0.0
**Schema Version:** 1.8.0
**Status:** Draft
**Date:** 2026-05-24

> Licensed under [Creative Commons Attribution 4.0 International (CC-BY-4.0)](./LICENSE-CC-BY-4.0.txt).
> "EvoMap", "GEP", and "Genome Evolution Protocol" are trademarks of EvoMap;
> see the repository's `NOTICE` file for details.

---

## Abstract

GEP (Genome Evolution Protocol) is an open protocol that enables AI agents to self-evolve by diagnosing limitations, synthesizing new capabilities, and installing them at runtime. GEP defines a standard lifecycle for agent evolution -- from signal detection to capability solidification -- along with content-addressable asset types that make evolution auditable, portable, and reproducible.

GEP is framework-agnostic. Any AI agent, regardless of its underlying model (GPT, Claude, Gemini, etc.) or orchestration framework (MCP, ADK, LangChain, etc.), can implement GEP to gain self-evolution capabilities.

---

## 1. Design Principles

1. **Append-only evolution**: All evolution artifacts are immutable once written. Changes produce new versions, not mutations of existing records.
2. **Content-addressable identity**: Every asset has a deterministic `asset_id` computed from its content via SHA-256, enabling deduplication and tamper detection.
3. **Causal memory**: The system refuses to evolve without a functioning memory graph. Every decision is traceable from signal to outcome.
4. **Blast radius awareness**: Every evolution cycle estimates and constrains the scope of changes before execution.
5. **Safe-by-default**: Constraints, validation commands, and rollback guarantees are mandatory, not optional.
6. **Sovereign portability**: An agent's evolution history belongs to its owner and can be exported/imported across platforms without loss.

---

## 2. Core Asset Types

GEP defines seven asset types. All share common envelope fields:

```
{
  "type": "<AssetType>",
  "schema_version": "1.6.0",
  "id": "<unique_id>",
  "asset_id": "sha256:<hex>",
  ...type-specific fields...
}
```

`Task` is the only type that does not produce a content-addressable
`asset_id` locally — Tasks are issued by the Hub and only carry the standard
a2a wire envelope; see §2.7.

### 2.1 Gene

A Gene is a reusable evolution strategy. It defines what signals it responds to, what steps to follow, and what safety constraints apply.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"Gene"` |
| `schema_version` | string | yes | Protocol schema version |
| `id` | string | yes | Unique identifier, e.g. `gene_gep_repair_from_errors` |
| `category` | enum | yes | One of: `"repair"`, `"optimize"`, `"innovate"`, `"explore"` |
| `signals_match` | string[] | yes | Patterns that trigger this gene (see pattern format below) |
| `preconditions` | string[] | no | Human-readable conditions that must hold |
| `strategy` | string[] | yes | Ordered, actionable steps (NOT summaries) |
| `constraints` | object | yes | Safety constraints (see below) |
| `validation` | string[] | yes | Commands to verify correctness after execution |
| `summary` | string | no | Single-line human description of what the gene does |
| `epigenetic_marks` | string[] | no | Runtime-applied behavioral modifiers |
| `learning_history` | object[] | no | Append-only log of selection / outcome / drift events; trimmed to the last 20 entries |
| `anti_patterns` | object[] | no | Failure modes the gene must avoid (consulted by the selector to suppress drift); trimmed to the last 12 entries |
| `asset_id` | string | yes | Content-addressable hash |

**Constraints object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `max_files` | integer | yes | Maximum files that may be modified |
| `forbidden_paths` | string[] | yes | Paths that must never be touched |

**`signals_match` pattern format:**

Each entry in `signals_match` is tested against the current signal array. Three formats are supported:

1. **Substring** (default): Case-insensitive substring match. Pattern `"timeout"` matches signal `"perf_bottleneck:connection timeout"`.
2. **Regex**: Wrapped in slashes `/pattern/flags`. Pattern `"/error.*retry/i"` matches any signal containing "error" followed by "retry".
3. **Multi-language alias**: Pipe-delimited alternatives `"term_en|term_zh|term_ja"`. Any branch matching counts as a hit. Enables cross-language gene discovery.

Example:
```json
{
  "signals_match": [
    "user_feature_request",
    "/timeout|ECONNREFUSED/i",
    "creative template|创意生成模板|創意生成模板|創造テンプレート"
  ]
}
```

**Category semantics:**
- `repair`: Fix errors, restore stability, reduce failure rate
- `optimize`: Improve existing capabilities, increase success rate
- `innovate`: Explore new strategies, break out of local optima
- `explore`: Investigate uncharted capability space without a concrete success target; outcomes feed `learning_history` rather than the production gene pool

### 2.2 Capsule

A Capsule is the record of a single successful evolution. It captures what triggered the evolution, which gene was used, and the outcome.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"Capsule"` |
| `schema_version` | string | yes | Protocol schema version |
| `id` | string | yes | Unique identifier, e.g. `capsule_1708123456789` |
| `trigger` | string[] | yes | Signals that triggered this evolution |
| `gene` | string | yes | ID of the gene that was used |
| `summary` | string | yes | Human-readable description of what was done |
| `confidence` | float | yes | 0.0-1.0, how confident the outcome is |
| `blast_radius` | object | yes | `{ files: int, lines: int }` |
| `outcome` | object | yes | `{ status: "success"|"failed", score: float }` |
| `success_streak` | integer | no | Consecutive successes with this gene |
| `success_reason` | string | no | Single-line explanation of why this evolution succeeded (consumed by recall index) |
| `gene_library_version` | string | no | Snapshot of the gene library version that produced this capsule |
| `env_fingerprint` | object | no | Runtime environment snapshot |
| `source_type` | enum | no | `"generated"`, `"reused"`, or `"reference"` — origin of the capsule (mirrors EvolutionEvent.source_type) |
| `reused_asset_id` | string | no | If `source_type="reused"`, the asset_id this capsule was reused from |
| `content` | object | no | Optional payload — when present, carries the materialized artifact (skill, tool config, etc.) the gene produced |
| `diff` | object | no | Optional structured diff of what changed during execution |
| `strategy` | string[] | no | Snapshot of the gene's strategy steps as actually executed |
| `execution_trace` | object[] | no | Per-stage trace; each entry includes a `stage` of `"build"`, `"validate"`, or `"canary"` |
| `a2a` | object | no | Agent-to-agent exchange metadata |
| `cost_tokens` | integer | no | Total tokens spent producing this evolution (input + output + cache); non-negative |
| `cost_usd` | float | no | Estimated USD spend producing this evolution; non-negative |
| `trigger_context` | object | no | Optional `{prompt, reasoning_trace, context_signals[], session_id, agent_model}` — what the user/agent was doing when this evolution fired |
| `asset_id` | string | yes | Content-addressable hash |

> **Capsule.outcome wire-format gate.** When publishing to the EvoMap Hub, only
> `outcome.status` and `outcome.score` participate in `asset_id` recomputation.
> Free-form fields (`outcome.notes`, `outcome.details`) ride on the wire but
> are stripped before hashing — implementations that include them in the
> local hash will produce IDs the Hub rejects with
> `capsule_asset_id_verification_failed`.

### 2.3 EvolutionEvent

An EvolutionEvent is the full audit record of one evolution cycle, regardless of outcome.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"EvolutionEvent"` |
| `schema_version` | string | yes | Protocol schema version |
| `id` | string | yes | e.g. `evt_1708123456789` |
| `parent` | string | no | ID of the previous event (chain) |
| `intent` | enum | yes | `"repair"`, `"optimize"`, `"innovate"`, or `"explore"` |
| `signals` | string[] | yes | Detected signals that triggered this cycle |
| `genes_used` | string[] | yes | Gene IDs selected for this cycle |
| `mutation_id` | string | yes | ID of the mutation object |
| `personality_state` | object | no | Personality parameters at execution time |
| `blast_radius` | object | yes | `{ files: int, lines: int }` |
| `outcome` | object | yes | `{ status: "success"|"failed", score: float }` |
| `capsule_id` | string | no | ID of generated capsule (if successful) |
| `source_type` | enum | yes | `"generated"`, `"reused"`, or `"reference"` |
| `reused_asset_id` | string | no | If reused from network, the original asset ID |
| `env_fingerprint` | object | no | Runtime environment snapshot |
| `validation_report_id` | string | no | ID of the validation report |
| `meta` | object | no | Additional metadata (timestamp, signal_key, etc.) |
| `trigger_context` | object | no | Optional `{prompt, reasoning_trace, context_signals[], session_id, agent_model}` — what the user/agent was doing when this evolution fired |
| `asset_id` | string | yes | Content-addressable hash |

### 2.4 Mutation

A Mutation describes the intended change before execution. It is a declaration of intent with risk assessment.

Unlike the other six asset types in §2, the reference engine treats
Mutation as a **transient in-memory object**: it lives only long enough
to drive a single execute/evaluate cycle and is not persisted as a
content-addressable artifact in `events.jsonl` (the surrounding
`EvolutionEvent.mutation_id` records the reference). Implementations
that *do* want to make Mutations content-addressable MAY stamp the
common envelope fields (`schema_version`, `asset_id`); both are
optional in this schema rather than required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"Mutation"` |
| `schema_version` | string | no | Protocol schema version (only present when an implementation chooses to make Mutations content-addressable) |
| `id` | string | yes | e.g. `mut_1708123456789` |
| `category` | enum | yes | `"repair"`, `"optimize"`, `"innovate"`, or `"explore"` |
| `trigger_signals` | string[] | yes | Signals that motivated this mutation |
| `target` | string | yes | Target of mutation, e.g. `"gene:gene_id"` or `"behavior:protocol"` |
| `expected_effect` | string | yes | Human-readable expected outcome |
| `risk_level` | enum | yes | `"low"`, `"medium"`, or `"high"` |
| `asset_id` | string | no | Content-addressable hash (only present when an implementation chooses to make Mutations content-addressable) |

**Risk level determination:**
- `low`: Default for repair and optimize
- `medium`: Default for innovate
- `high`: Only when explicitly allowed AND personality constraints are met (rigor >= 0.6, risk_tolerance <= 0.5)

**Safety downgrades (mandatory):**
- If category is `innovate` AND personality has high risk (low rigor or high risk_tolerance): downgrade to `optimize`
- If risk_level is `high` AND personality does not meet strict safety constraints: downgrade to `medium`

### 2.5 ValidationReport

A ValidationReport captures the results of running validation commands after an evolution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"ValidationReport"` |
| `schema_version` | string | yes | Protocol schema version |
| `id` | string | yes | e.g. `vr_1708123456789` |
| `gene_id` | string | yes | Gene whose validations were run |
| `env_fingerprint` | object | no | Environment at validation time |
| `commands` | object[] | yes | Array of `{ command, ok, stdout, stderr }` |
| `overall_ok` | boolean | yes | True if all commands passed |
| `duration_ms` | integer | yes | Total validation duration |
| `created_at` | string | yes | ISO 8601 timestamp |
| `asset_id` | string | yes | Content-addressable hash |

### 2.6 MemoryGraphEvent

A MemoryGraphEvent is an append-only entry in the causal memory graph. It records signals, hypotheses, attempts, and outcomes.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"MemoryGraphEvent"` |
| `kind` | enum | yes | See kinds below |
| `id` | string | yes | e.g. `mge_1708123456789_abcdef01` |
| `ts` | string | yes | ISO 8601 timestamp |
| `signal` | object | conditional | `{ key, signals[], error_signature }` |
| `gene` | object | conditional | `{ id, category }` |
| `mutation` | object | conditional | Mutation snapshot |
| `personality` | object | no | Personality snapshot |
| `outcome` | object | conditional | `{ status, score, note }` |
| `hypothesis` | object | conditional | `{ id, text, predicted_outcome }` |
| `action` | object | conditional | `{ id, drift, selected_by, selector }` |
| `stats` | object | conditional | Aggregated confidence statistics |
| `observed` | object | no | Observational metadata |

**Kinds:**
- `signal`: Raw signal detection snapshot
- `hypothesis`: Predicted outcome before execution
- `attempt`: Chosen causal path for execution
- `outcome`: Inferred result of the previous attempt
- `confidence_edge`: Aggregated (signal_key, gene_id) success probability
- `confidence_gene_outcome`: Aggregated gene-level success probability
- `external_candidate`: Externally received asset staged for local evaluation

### 2.7 Task

A Task is a bounty-bearing work item issued by the EvoMap Hub. Unlike the
six asset types above, Tasks are not authored or hashed locally — they are
received by worker nodes, claimed, executed, and reported back. Tasks
participate in the same a2a wire envelope as evolution assets, but carry
no `asset_id`; provenance is established through `task_id` plus the
node-scoped sender signature on the a2a envelope.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Always `"Task"` |
| `task_id` | string | yes | Hub-assigned identifier |
| `title` | string | no | Short human-readable label |
| `signals` | string | no | Free-form description of the signal pattern this task addresses (Hub-side index) |
| `status` | enum | yes | `"open"`, `"claimed"`, `"completed"`, `"expired"`, `"cancelled"` |
| `claimed_by` | string | no | `node_id` of the worker that claimed this task |
| `bounty_id` | string | no | Reference to a Hub bounty record |
| `bounty_amount` | number | no | ATP/credit amount paid on completion |
| `complexity_score` | number | no | Hub-estimated difficulty (0..1) |
| `historical_completion_rate` | number | no | Fraction of historically similar tasks that completed successfully |
| `expires_at` | string | no | ISO 8601 — task auto-cancels if unclaimed past this point |
| `body` | string | no | Detailed problem statement |
| `description` | string | no | Auxiliary description; may overlap with `body` |
| `nonce` | string | no | One-shot anti-replay nonce included in the a2a claim envelope |
| `validation_commands` | string[] | no | Commands the worker must run to certify completion |
| `result_asset_id` | string | no | `asset_id` of the Capsule/EvolutionEvent the worker produced |
| `atp_order_id` | string | no | ATP settlement order id once payment clears |

Task implementations may carry additional implementation-private fields
(e.g. local commitment timers); the schema is `additionalProperties: true`
to accommodate this without forcing breaking changes on every Hub
extension.

---

## 3. Evolution Cycle

A complete GEP evolution cycle consists of 7 phases:

```
1. DETECT --> 2. SELECT --> 3. MUTATE --> 4. HYPOTHESIZE
     |                                         |
     v                                         v
5. EXECUTE --> 6. EVALUATE --> 7. SOLIDIFY
```

### 3.1 Detect

**Input:** Runtime context (session logs, error logs, memory, user instructions)
**Output:** Signal array (string[])

Signal detection scans the runtime context for patterns that indicate a need for evolution. Detection supports four languages: English, Chinese (Simplified and Traditional), and Japanese.

**Error signals** (trigger `repair` intent):
- `log_error` -- structured error markers detected (EN: `error:`, `exception:`; ZH: `错误:`, `异常:`, `报错:`, `失败:`)
- `errsig:<detail>` -- specific error signature (clipped to 260 chars)
- `recurring_error` -- same error appearing 3+ times
- `memory_missing`, `session_logs_missing` -- missing resources

**Opportunity signals** (trigger `innovate` intent):

Opportunity signals carry a context snippet suffix: `signal_name:snippet`. The snippet captures the surrounding text that triggered the signal, enabling more precise gene selection across domains.

- `user_feature_request:<snippet>` -- user asks for new capability (EN: "I want", "please add"; ZH: "我想", "加个", "帮我加"; JA: "追加", "実装", "が欲しい")
- `user_improvement_suggestion:<snippet>` -- user suggests improvement (EN: "improve", "refactor"; ZH: "优化一下", "重构"; JA: "改善", "リファクタ")
- `capability_gap` -- something is unsupported
- `perf_bottleneck` -- performance issue detected
- `stable_success_plateau` -- system is stable, ready for innovation

**Meta signals** (evolution control):
- `evolution_stagnation_detected` -- all signals suppressed, stuck in loop
- `repair_loop_detected` -- 3+ consecutive repairs
- `force_innovation_after_repair_loop` -- circuit breaker activated
- `evolution_saturation` -- consecutive empty cycles detected
- `force_steady_state` -- 5+ consecutive empty cycles
- `ban_gene:<gene_id>` -- suppress a specific gene after failure streak

**De-duplication rules:**
- Signals appearing in 3+ of the last 8 events are suppressed
- If all signals are suppressed, inject `evolution_stagnation_detected`
- After 3+ consecutive repairs, strip repair signals and force innovation

### 3.2 Select

**Input:** Genes, Capsules, Signals, Memory advice
**Output:** Selected gene, capsule candidates, selector decision

Gene selection uses a two-layer system:

1. **Pattern matching**: Each gene's `signals_match` patterns are tested against current signals. Score = count of matching patterns.
2. **Memory graph advice**: Historical (signal_key, gene_id) -> outcome data provides preferred/banned gene recommendations.

**Selection algorithm:**
```
1. Score all genes by pattern match count
2. Filter out banned genes (from memory graph, unless drift is active)
3. If memory graph has a preferred gene that is also a match candidate, prefer it
4. Apply genetic drift: with probability proportional to driftIntensity, select randomly from top candidates instead of always picking the best
```

**Genetic drift:**
- `driftIntensity = 1 / sqrt(Ne)` where Ne = effective population size (gene count)
- Small gene pool = more drift (exploration)
- Large gene pool = less drift (exploitation)
- Distilled genes (`gene_distilled_*`) receive a 0.8x score factor (conservative initial weighting)

### 3.3 Mutate

**Input:** Signals, selected gene, drift state, personality
**Output:** Mutation object

A Mutation declaration is built with:
- Category determined by signals (error -> repair, opportunity -> innovate, else -> optimize)
- Risk level assigned by category (repair=low, optimize=low, innovate=medium, explore=medium)
- Safety downgrades applied automatically based on personality constraints

### 3.4 Hypothesize

**Input:** Signals, mutation, gene, personality
**Output:** Hypothesis ID recorded in memory graph

Before execution, the system records a hypothesis: "Given these signals, using this gene with this mutation, I expect this outcome." This creates a falsifiable prediction in the causal chain.

### 3.5 Execute

The execution phase is implementation-specific. GEP defines the protocol around execution, not the execution itself. Typical execution involves:

1. Building a prompt that includes: signals, selected gene, capsule candidates, mutation, constraints
2. Dispatching to an LLM or agent executor
3. The executor applies code changes following the gene's strategy steps
4. Changes must respect the gene's constraints (max_files, forbidden_paths)

### 3.6 Evaluate

**Input:** Changed files, validation commands, blast radius
**Output:** Outcome (success/failed, score)

Evaluation consists of:

1. **Blast radius computation**: Count files and lines changed
2. **Constraint checking**: Verify changes don't exceed max_files or touch forbidden_paths
3. **Validation execution**: Run gene's validation commands
4. **Canary check**: Optional pre-solidify safety verification
5. **Score computation**: 0.0-1.0 based on validation results, blast radius, and constraint compliance

**Hard caps** (configurable but mandatory):
- `EVOLVER_HARD_CAP_FILES`: Maximum files changed per cycle (default: 60)
- `EVOLVER_HARD_CAP_LINES`: Maximum lines changed per cycle (default: 20000)

### 3.7 Solidify

**Input:** Evaluation results, gene, mutation, environment
**Output:** EvolutionEvent, updated Gene, Capsule (if successful)

Solidification is the protocol closure step:

1. Build an EvolutionEvent with full audit data
2. Append to events.jsonl (append-only)
3. If outcome is success:
   - Create or update a Capsule
   - Apply epigenetic marks to the gene (runtime behavioral modifiers)
   - Optionally trigger skill distillation
4. If outcome is failed:
   - Record event but do not create capsule
   - Optionally rollback changes (git reset)
5. Update memory graph with outcome
6. Update solidify state (marks this cycle as complete)

---

## 4. Memory Graph

The memory graph is an append-only JSONL file that records the causal chain of evolution decisions. It enables:

- **Experience reuse**: Historical (signal, gene) -> outcome mappings guide future selections
- **Path suppression**: Low-success paths are automatically banned
- **Confidence decay**: Older experiences carry less weight (exponential half-life, default 30 days)
- **Signal similarity**: Jaccard similarity matches current signals against historical patterns (threshold: 0.34)

**Aggregation formula (Laplace-smoothed):**
```
p = (successes + 1) / (total + 2)
weight = 0.5 ^ (age_days / half_life_days)
value = p * weight
```

**Ban threshold**: A gene is banned for a signal pattern when it has 2+ attempts AND value < 0.18.

---

## 5. Content Addressing

All GEP assets use content-addressable IDs for integrity:

1. Remove the `asset_id` field from the object
2. Canonicalize: Sort all object keys recursively, preserve array order, convert non-finite numbers to null
3. SHA-256 hash the canonical JSON string
4. Format as `"sha256:<hex>"`

**Verification:**
```
claimed_id === computeAssetId(object_without_asset_id)
```

---

## 6. Skill Distillation

Skill distillation is a meta-evolution process that synthesizes new genes from accumulated capsule data.

**Trigger conditions (all must be met):**
1. Last 10 capsules have >= 7 successes
2. At least 24 hours since last distillation
3. Not explicitly disabled

**Process:**
1. **Collect**: Filter successful capsules (score >= 0.7), group by gene
2. **Analyze**: Identify high-frequency success patterns, strategy drift, coverage gaps
3. **Synthesize**: LLM generates a new Gene JSON from the analysis
4. **Validate**: Structure check, safety check, deduplication check

**Distilled gene constraints:**
- ID prefix: `gene_distilled_`
- `constraints.max_files` capped at 12 (more conservative)
- Initial selection score factor: 0.8x
- Full audit trail in `distiller_log.jsonl`

---

## 7. Signal Types Reference

### Error Signals
| Signal | Description |
|--------|-------------|
| `log_error` | Structured error marker detected |
| `errsig:<detail>` | Specific error signature (clipped to 260 chars) |
| `recurring_error` | Same error pattern appearing 3+ times |
| `recurring_errsig(<N>x):<detail>` | Recurring error with count |
| `memory_missing` | MEMORY.md not found |
| `session_logs_missing` | No session logs found |
| `integration_key_missing` | Required API key missing |

### Opportunity Signals
| Signal | Description |
|--------|-------------|
| `user_feature_request:<snippet>` | User asks for new capability (multi-lang: EN/ZH/JA) |
| `user_improvement_suggestion:<snippet>` | User suggests improvement (multi-lang: EN/ZH/JA) |
| `perf_bottleneck` | Performance issue detected |
| `capability_gap` | Unsupported functionality identified |
| `stable_success_plateau` | System stable, ready for innovation |
| `external_opportunity` | External event presents opportunity |

### Control Signals
| Signal | Description |
|--------|-------------|
| `evolution_stagnation_detected` | All signals suppressed |
| `repair_loop_detected` | 3+ consecutive repairs |
| `force_innovation_after_repair_loop` | Circuit breaker: force innovate |
| `empty_cycle_loop_detected` | 50%+ empty cycles in last 8 |
| `evolution_saturation` | 3+ consecutive empty cycles |
| `force_steady_state` | 5+ consecutive empty cycles |
| `consecutive_failure_streak_<N>` | N consecutive failures |
| `failure_loop_detected` | 5+ consecutive failures |
| `ban_gene:<gene_id>` | Suppress specific gene |
| `high_failure_ratio` | 75%+ failures in last 8 cycles |

---

## 8. File Format Reference

| File | Format | Description |
|------|--------|-------------|
| `genes.json` | JSON | Gene definitions (`{ version: int, genes: Gene[] }`) |
| `genes.jsonl` | JSONL | Append-only gene additions (merged with genes.json) |
| `capsules.json` | JSON | Capsule store (`{ version: int, capsules: Capsule[] }`) |
| `capsules.jsonl` | JSONL | Append-only capsule additions |
| `events.jsonl` | JSONL | Append-only evolution event log |
| `candidates.jsonl` | JSONL | Local capability candidates |
| `external_candidates.jsonl` | JSONL | Externally received candidates |
| `memory_graph.jsonl` | JSONL | Append-only causal memory graph |
| `distiller_log.jsonl` | JSONL | Skill distillation audit log |

---

## 9. Portable Evolution Archive (.gepx)

A `.gepx` file is a gzipped tar archive containing all evolution assets for an agent:

```
<agent-name>.gepx/
  manifest.json           # Version, source, statistics, created_at
  genes/
    genes.json            # All gene definitions
    genes.jsonl           # Append-only gene log
  capsules/
    capsules.json         # All capsule records
    capsules.jsonl        # Append-only capsule log
  events/
    events.jsonl          # Full evolution event history
  memory/
    memory_graph.jsonl    # Causal memory graph
  distiller/
    distiller_log.jsonl   # Distillation audit log
  checksum.sha256         # Integrity checksums for all files
```

**manifest.json format:**
```json
{
  "gep_version": "1.0.0",
  "schema_version": "1.6.0",
  "created_at": "2026-02-22T12:00:00.000Z",
  "agent_id": "ab1599b1-ccd0-4aa3-9107-90033926341e",
  "agent_name": "main",
  "statistics": {
    "total_events": 906,
    "total_genes": 12,
    "total_capsules": 45,
    "success_rate": 0.73,
    "memory_graph_entries": 5400
  },
  "source": {
    "platform": "evolver",
    "version": "1.17.1"
  }
}
```

---

## 10. Interoperability

GEP is designed to bridge with existing agent protocols:

### 10.1 MCP (Model Context Protocol)

GEP evolution capabilities are exposed as MCP tools by the reference
implementation [`@evomap/gep-mcp-server`](https://github.com/EvoMap/gep-mcp-server).
Tools split into three groups; the **local** group runs against on-disk asset
stores, the **remote** group requires `EVOMAP_NODE_ID` plus an
`EVOMAP_API_KEY` or `EVOMAP_NODE_SECRET`, and the **shared** group is
available in either mode.

| Group | Tool | Purpose |
|-------|------|---------|
| shared | `gep_evolve` | Trigger an evolution cycle from a context blob; returns the evolution plan |
| shared | `gep_recall` | Query the memory graph for prior signal-gene-outcome paths |
| shared | `gep_record_outcome` | Record the outcome of a task into evolution memory |
| shared | `gep_list_genes` | List installed genes, optionally filtered by category |
| shared | `gep_status` | Report gene count, capsule count, memory size, recent events |
| shared | `gep_protocol_info` | Return the schema/protocol versions this build speaks (drift detection) |
| local  | `gep_install_gene` | Install a Gene object into the local gene pool |
| local  | `gep_export` | Export evolution history as a portable `.gepx` archive |
| remote | `gep_search_community` | Semantic search across Hub-published assets |
| remote | `gep_publish_bundle` | Publish a Gene + Capsule (+ optional EvolutionEvent) bundle |
| remote | `gep_publish_skill` | Convert a Gene to `SKILL.md` and publish to the skill marketplace |
| remote | `gep_submit_validation_report` | Submit a `ValidationReport`, optionally anchored to a published `asset_id` |
| remote | `gep_revoke` | Withdraw a previously published asset |
| remote | `gep_identity` | Fetch a node's portable identity profile (DID document) |
| remote | `gep_audit` | Read recent audit log rows for a node |

**Resources** (read-only):
- `gep://spec` -- this protocol specification
- `gep://genes` -- installed gene definitions
- `gep://capsules` -- capsule records (Hub-side in remote mode)

Implementations MUST report their schema version through `gep_protocol_info`
so callers (such as evox-side `EvolverMcpStrategy`) can refuse to talk to
servers ahead of or behind their pinned major version.

### 10.2 A2A (Agent-to-Agent)

GEP assets can be exchanged between agents via any A2A protocol:
- Genes and Capsules are self-contained and content-addressable
- External candidates are staged (never executed directly) and require local validation
- The memory graph records provenance of external assets

### 10.3 Framework Adapters

GEP can be integrated with any agent framework through adapters that implement:
1. Signal extraction from the framework's context
2. Execution dispatch to the framework's action system
3. Outcome observation from the framework's result handling

---

## 11. Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `GEP_ASSETS_DIR` | `<repo>/assets/gep` | GEP asset storage directory |
| `MEMORY_GRAPH_PATH` | `<evo>/memory_graph.jsonl` | Memory graph file path |
| `EVOLVER_HARD_CAP_FILES` | `60` | Max files per evolution cycle |
| `EVOLVER_HARD_CAP_LINES` | `20000` | Max lines per evolution cycle |
| `SKILL_DISTILLER` | `true` | Enable skill distillation |
| `DISTILLER_MIN_CAPSULES` | `10` | Min capsules for distillation trigger |
| `DISTILLER_INTERVAL_HOURS` | `24` | Min hours between distillations |
| `DISTILLER_MIN_SUCCESS_RATE` | `0.7` | Min success rate to trigger |

---

## Appendix A: Canonical JSON Algorithm

```
function canonicalize(obj):
  if obj is null or undefined: return "null"
  if obj is boolean: return "true" or "false"
  if obj is number:
    if not finite: return "null"
    return String(obj)
  if obj is string: return JSON.stringify(obj)
  if obj is array: return "[" + obj.map(canonicalize).join(",") + "]"
  if obj is object:
    keys = Object.keys(obj).sort()
    pairs = keys.map(k => JSON.stringify(k) + ":" + canonicalize(obj[k]))
    return "{" + pairs.join(",") + "}"
  return "null"

function computeAssetId(obj):
  clean = copy of obj without "asset_id" field
  canonical = canonicalize(clean)
  hash = SHA256(canonical as UTF-8)
  return "sha256:" + hex(hash)
```

---

## Appendix B: Outcome Inference

When direct outcome observation is unavailable, GEP infers outcomes from signal comparison:

| Previous Error | Current Error | Status | Base Score | Note |
|---------------|---------------|--------|------------|------|
| Yes | No | success | 0.85 | error_cleared |
| Yes | Yes | failed | 0.20 | error_persisted |
| No | Yes | failed | 0.15 | new_error_appeared |
| No | No | success | 0.60 | stable_no_error |

Enhanced inference adjusts the base score by:
- Error count delta (max +/- 0.12)
- Scan time improvement ratio (max +/- 0.06)
- Observed EvolutionEvent outcome from evidence text (overrides heuristic)

---

## Appendix C: Schema Version History

### 1.8.0 (2026-05-24)

Additive Capsule fields supporting **user-authored capsules** — i.e.
capsules a human operator hand-crafts (or composes from existing genes)
in their local agent and wants to share to the EvoMap Hub. All changes
are backward-compatible; existing 1.7.0 assets validate unchanged and
their `asset_id` is byte-stable under §5 because absent properties never
enter the canonical form.

**Capsule fields added (all optional):**

- `visibility` — string enum `private | unlisted | public`. Selects who
  can recall a published capsule from the Hub. `private` = author-only;
  `unlisted` = recallable by direct `asset_id` only; `public` = listed
  in browse/search. Absent ⇒ implementation default (typically
  `private` for new user-authored content).
- `scope` — array of strings. Free-form tags the author attaches to
  scope the capsule's intended use (e.g. `["rust", "tokio", "debug"]`).
  Distinct from `trigger` (which encodes machine-detected signals);
  `scope` is operator intent and recall implementations MAY use it as
  a soft filter.
- `cost_tier` — string enum `cheap | standard | premium`. Stable
  routing label that lets cost-aware selectors prefer cheaper capsules
  first, even when point-in-time `cost_tokens` / `cost_usd` are absent.
- `pack_of` — array of capsule `asset_id`s. Indicates this capsule is a
  composition (a "pack") of the listed capsules; recall implementations
  MAY surface the constituents alongside the pack.
- `author` — object `{ handle, evox_install_id }`. Identifies the human
  operator who authored the capsule. `handle` is a free-form display
  name; `evox_install_id` is the local install identifier and lets a
  user reconcile their own published artefacts across nodes.

**`source_type` enum extended (Capsule + EvolutionEvent):**

- New value `"user_authored"` joins `generated | reused | reference`.
  Implementations producing a capsule from an interactive operator
  command (e.g. evox's `/capsule save`) SHOULD set this; downstream
  recall MAY use it to favour or filter authored content. The same
  enum extension applies to `EvolutionEvent.source_type` so that
  audit events emitted alongside a user-authored capsule can carry
  the matching label.

**Protocol constants (`@evomap/gep-sdk` JS exports):**

- `GEP_SOURCE_TYPES` includes `'user_authored'`.
- New: `GEP_CAPSULE_VISIBILITIES` = `['private', 'unlisted', 'public']`.
- New: `GEP_CAPSULE_COST_TIERS` = `['cheap', 'standard', 'premium']`.

These let validators on the Hub side share enums with client
implementations (evolver, gep-mcp-server, evox-Rust) without
re-declaring them per consumer.

### 1.7.0 (2026-05-20)

Additive Capsule cost-attribution fields. All changes backward-compatible;
existing 1.6.0 assets validate unchanged and their `asset_id` is byte-stable
under the canonicalization rules of §5 because absent properties never enter
the canonical form.

**Capsule fields added (both optional):**
- `cost_tokens` — non-negative integer; total tokens spent producing this
  evolution (input + output + cache where the implementation can attribute).
- `cost_usd` — non-negative float; estimated USD cost. Useful when the
  capsule was produced by a routed mixture of model tiers and a flat token
  count would understate spend.

These fields let recall implementations apply budget filters (e.g. "return
the highest-score capsule under N tokens") without needing a separate
cost-tracking index. Capsules persisted before this revision carry no cost
fields; recall implementations MUST treat absent values as unknown and
SHOULD NOT exclude them from results (conservative carry-forward).

### 1.6.0 (2026-05-16)

Brings the spec back into lockstep with the reference implementations
([`evolver`](https://github.com/EvoMap/evolver) at v1.83.0 and
[`gep-mcp-server`](https://github.com/EvoMap/gep-mcp-server) at v1.4.0).
All changes are backward-compatible additions (additional fields and a
new enum value); existing 1.5.0 assets validate unchanged.

**Enums extended (additive):**
- `Gene.category`, `Mutation.category`, `EvolutionEvent.intent` accept the
  new value `"explore"`. Previously documented in the spec as 3-way
  (`repair|optimize|innovate`) but the reference engine had been emitting
  `"explore"` since v1.80.8; this revision ratifies the de-facto enum.

**Gene fields added (all optional):**
- `summary` -- single-line human description.
- `learning_history` -- bounded append-only log of selection / outcome / drift
  events (last 20 retained).
- `anti_patterns` -- bounded failure-mode log the selector consults to suppress
  drift (last 12 retained).

**Capsule fields added (all optional):**
- `success_reason`, `gene_library_version`, `source_type`, `reused_asset_id`,
  `content`, `diff`, `strategy`, `execution_trace`, `trigger_context`.
- Adds the wire-format gate clarifying that `outcome.notes` and
  `outcome.details` are stripped before `asset_id` recomputation on the
  Hub.

**EvolutionEvent fields added (all optional):**
- `trigger_context` -- mirrors `Capsule.trigger_context`.

**New asset type — Task (§2.7):**
Documents the bounty-bearing work item that the EvoMap Hub issues to
worker nodes. Tasks do not produce a content-addressable `asset_id`
locally; provenance comes from the a2a wire envelope.

**MCP surface (§10.1):**
Replaces the 5-tool sketch with the actual 16-tool surface exposed by
`@evomap/gep-mcp-server`, split into local / remote / shared groups.

### 1.5.0 (2026-02-22)

Initial spec release. Six asset types: Gene, Capsule, EvolutionEvent,
Mutation, ValidationReport, MemoryGraphEvent.
