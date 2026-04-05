#!/usr/bin/env node

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { program } from 'commander';
import { git, gitLines, symbols, header, fatal, isInsideGitRepo, getRepoRoot, relativeTime, formatDate } from './utils.js';

program
  .name('git-who')
  .description('Show who knows a file or directory best — top contributors ranked by ownership and activity')
  .argument('[path]', 'file or directory to inspect (default: current directory)', '.')
  .option('-n, --top <number>', 'number of contributors to show', '5')
  .addHelpText('after', `
Examples:
  git who                       Who knows this repo best?
  git who src/index.js          Top contributors for a specific file
  git who src/                  Top contributors for a directory
  git who -n 10 .               Show top 10 contributors repo-wide`)
  .version('1.0.0')
  .action(run);

program.parse();

function runFile(file, top) {
  // Check file exists in repo
  try {
    git(['ls-files', '--error-unmatch', file]);
  } catch {
    fatal(`File not tracked by git: ${file}`);
  }

  // Get blame data
  let blameLines;
  try {
    blameLines = gitLines(['blame', '--line-porcelain', file]);
  } catch {
    fatal(`Cannot blame ${file} — is it a binary or empty file?`);
  }

  const authorLines = {};
  let currentAuthor = null;
  let totalLines = 0;

  for (const line of blameLines) {
    if (line.startsWith('author ')) {
      currentAuthor = line.slice(7);
      if (currentAuthor === 'Not Committed Yet') currentAuthor = null;
    } else if (line.startsWith('\t')) {
      if (currentAuthor) {
        authorLines[currentAuthor] = (authorLines[currentAuthor] || 0) + 1;
        totalLines++;
      }
    }
  }

  const logOutput = gitLines([
    'log', '--format=%an%x00%aI%x00%s', '--follow', '--', file,
  ]);

  const authorCommits = {};
  const authorLastDate = {};
  let lastModifiedBy = null;
  let lastModifiedDate = null;

  for (const line of logOutput) {
    const [name, date, ...msgParts] = line.split('\0');
    if (!authorCommits[name]) authorCommits[name] = [];
    authorCommits[name].push({ date });

    if (!lastModifiedBy) {
      lastModifiedBy = name;
      lastModifiedDate = date;
    }

    if (!authorLastDate[name] || date > authorLastDate[name]) {
      authorLastDate[name] = date;
    }
  }

  // Build ranked list
  const authors = Object.keys({ ...authorLines, ...authorCommits });
  const ranked = authors.map((name) => {
    const lines = authorLines[name] || 0;
    const commits = (authorCommits[name] || []).length;
    const pct = totalLines > 0 ? (lines / totalLines) * 100 : 0;
    const lastDate = authorLastDate[name] || null;
    return { name, lines, commits, pct, lastDate };
  });

  const maxLines = Math.max(...ranked.map((r) => r.lines), 1);
  const maxCommits = Math.max(...ranked.map((r) => r.commits), 1);
  ranked.forEach((r) => {
    r.score = 0.6 * (r.lines / maxLines) + 0.4 * (r.commits / maxCommits);
  });
  ranked.sort((a, b) => b.score - a.score);

  header(`git who ${chalk.white(file)}`);

  if (lastModifiedBy) {
    console.log(
      `  ${chalk.dim('Last modified by')} ${chalk.yellow(lastModifiedBy)} ${chalk.dim(relativeTime(lastModifiedDate))} ${chalk.dim(`(${formatDate(lastModifiedDate)})`)}`
    );
    console.log();
  }

  console.log(chalk.bold('  Top contributors:\n'));

  const display = ranked.slice(0, top);

  if (display.length === 0) {
    console.log(chalk.dim('  No contributors found.\n'));
    return;
  }

  const maxNameLen = Math.max(...display.map((r) => r.name.length));

  display.forEach((r, i) => {
    const rank = i === 0 ? chalk.yellow('★') : chalk.dim(`${i + 1}`);
    const name = r.name.padEnd(maxNameLen);
    const barLen = Math.max(1, Math.round(r.pct / 3));
    const bar = '█'.repeat(barLen);
    const pctStr = `${r.pct.toFixed(0)}%`.padStart(4);
    const color = i === 0 ? chalk.yellow : i === 1 ? chalk.white : chalk.dim;

    console.log(
      `  ${rank}  ${color(name)}  ${chalk.green(bar)} ${chalk.dim(pctStr)} lines  ${chalk.dim(`${r.commits} commits`)}  ${r.lastDate ? chalk.dim(relativeTime(r.lastDate)) : ''}`
    );
  });

  console.log();
  if (ranked.length > 0) {
    const best = ranked[0];
    console.log(
      `  ${chalk.cyan(symbols.arrow)} ${chalk.dim('Ask')} ${chalk.bold.cyan(best.name)} ${chalk.dim('— they own')} ${chalk.white(`${best.pct.toFixed(0)}%`)} ${chalk.dim('of lines and made')} ${chalk.white(best.commits)} ${chalk.dim('commits')}`
    );
    if (ranked.length > 1 && ranked[1].score > 0.5) {
      console.log(
        `  ${chalk.dim('  or')} ${chalk.cyan(ranked[1].name)} ${chalk.dim(`(${ranked[1].pct.toFixed(0)}% lines, ${ranked[1].commits} commits)`)}`
      );
    }
  }
  console.log();
}

function runDirectory(dir, top) {
  const displayPath = dir === '.' ? getRepoRoot().split('/').pop() : dir;

  // Get contributor stats via shortlog
  const shortlogLines = gitLines(['shortlog', '-sne', '--no-merges', 'HEAD', '--', dir]);

  const authorCommits = {};
  for (const line of shortlogLines) {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+<(.+?)>\s*$/);
    if (match) {
      const [, count, name] = match;
      authorCommits[name] = parseInt(count, 10);
    }
  }

  // Get last activity per author
  const logLines = gitLines(['log', '--format=%an%x00%aI', '--no-merges', '--', dir]);
  const authorLastDate = {};
  let lastModifiedBy = null;
  let lastModifiedDate = null;

  for (const line of logLines) {
    const [name, date] = line.split('\0');
    if (!lastModifiedBy) {
      lastModifiedBy = name;
      lastModifiedDate = date;
    }
    if (!authorLastDate[name]) {
      authorLastDate[name] = date;
    }
  }

  // Get total commits for percentage
  const totalCommits = Object.values(authorCommits).reduce((a, b) => a + b, 0);

  // Build ranked list
  const ranked = Object.entries(authorCommits).map(([name, commits]) => ({
    name,
    commits,
    pct: totalCommits > 0 ? (commits / totalCommits) * 100 : 0,
    lastDate: authorLastDate[name] || null,
  }));
  ranked.sort((a, b) => b.commits - a.commits);

  header(`git who ${chalk.white(displayPath + '/')}`);

  if (lastModifiedBy) {
    console.log(
      `  ${chalk.dim('Last modified by')} ${chalk.yellow(lastModifiedBy)} ${chalk.dim(relativeTime(lastModifiedDate))} ${chalk.dim(`(${formatDate(lastModifiedDate)})`)}`
    );
    console.log();
  }

  console.log(chalk.bold('  Top contributors:\n'));

  const display = ranked.slice(0, top);
  const maxNameLen = Math.max(...display.map((r) => r.name.length), 1);

  display.forEach((r, i) => {
    const rank = i === 0 ? chalk.yellow('★') : chalk.dim(`${i + 1}`);
    const name = r.name.padEnd(maxNameLen);
    const barLen = Math.max(1, Math.round(r.pct / 3));
    const bar = '█'.repeat(barLen);
    const pctStr = `${r.pct.toFixed(0)}%`.padStart(4);
    const color = i === 0 ? chalk.yellow : i === 1 ? chalk.white : chalk.dim;

    console.log(
      `  ${rank}  ${color(name)}  ${chalk.green(bar)} ${chalk.dim(pctStr)} commits (${chalk.white(r.commits)})  ${r.lastDate ? chalk.dim(relativeTime(r.lastDate)) : ''}`
    );
  });

  console.log();
  if (ranked.length > 0) {
    const best = ranked[0];
    console.log(
      `  ${chalk.cyan(symbols.arrow)} ${chalk.dim('Ask')} ${chalk.bold.cyan(best.name)} ${chalk.dim('—')} ${chalk.white(`${best.pct.toFixed(0)}%`)} ${chalk.dim('of commits')} ${chalk.dim(`(${best.commits} total)`)}`
    );
    if (ranked.length > 1 && ranked[1].pct > 15) {
      console.log(
        `  ${chalk.dim('  or')} ${chalk.cyan(ranked[1].name)} ${chalk.dim(`(${ranked[1].pct.toFixed(0)}%, ${ranked[1].commits} commits)`)}`
      );
    }
  }
  console.log();
}

function run(pathArg, opts) {
  if (!isInsideGitRepo()) fatal('Not inside a git repository');

  const top = parseInt(opts.top, 10);
  if (!Number.isFinite(top) || top < 1) fatal(`Invalid --top value: "${opts.top}" (must be a positive integer)`);
  const resolvedPath = resolve(pathArg);

  let isDir = false;
  try {
    isDir = statSync(resolvedPath).isDirectory();
  } catch {
    // Path might not exist on disk but could be a git-tracked file
    // Try as a file
  }

  if (isDir) {
    runDirectory(pathArg, top);
  } else {
    runFile(pathArg, top);
  }
}
