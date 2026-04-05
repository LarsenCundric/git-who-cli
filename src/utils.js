import { execFileSync } from 'node:child_process';
import chalk from 'chalk';

export function git(args, opts = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).trim();
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

export function gitLines(args, opts = {}) {
  const out = git(args, opts);
  return out ? out.split('\n') : [];
}

export function isInsideGitRepo() {
  try {
    git(['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

export function getRepoRoot() {
  return git(['rev-parse', '--show-toplevel']);
}

export const symbols = {
  bullet: '●',
  arrow: '→',
  check: '✓',
  cross: '✗',
  warning: '⚠',
  line: '─',
};

export function header(text) {
  // Strip ANSI codes to get the visible length for alignment
  const visibleLength = text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').length;
  const line = symbols.line.repeat(Math.max(0, 50 - visibleLength));
  console.log(`\n${chalk.bold.cyan(text)} ${chalk.dim(line)}\n`);
}

export function fatal(msg) {
  console.error(`${chalk.red(symbols.cross)} ${msg}`);
  process.exit(1);
}

export function relativeTime(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
