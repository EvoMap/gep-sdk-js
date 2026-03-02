import { execSync } from 'child_process';

/**
 * Check whether a directory is inside a git repository.
 * Returns { ok, gitDir } on success, { ok: false, error } on failure.
 */
export function checkGitRepo(cwd) {
  const dir = cwd || process.cwd();
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd: dir, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000,
    }).trim();
    return { ok: true, gitDir };
  } catch (_) {
    return { ok: false, error: 'Not a git repository: ' + dir };
  }
}

/**
 * Assert that the working directory is a git repo.
 * Throws with a clear message if not.
 */
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
