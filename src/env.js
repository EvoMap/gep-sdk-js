import { execFileSync } from 'node:child_process';

export function checkGitRepo(cwd) {
  const dir = cwd || process.cwd();
  try {
    const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: dir, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000,
    }).trim();
    return { ok: true, gitDir };
  } catch (_) {
    return { ok: false, error: 'Not a git repository: ' + dir };
  }
}

export function requireGitRepo(cwd) {
  const result = checkGitRepo(cwd);
  if (!result.ok) {
    throw new Error(
      '[GEP] ' + result.error + '\n' +
      'GEP requires git for rollback, blast radius calculation, and solidify.\n' +
      'Run "git init && git add -A && git commit -m init" in your project root.'
    );
  }
  return result;
}
