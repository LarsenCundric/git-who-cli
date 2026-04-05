# git-who

> Find who knows a file (or codebase) best. `git blame` + `git log` = actionable ownership insights.

## Install

```sh
npm install -g git-who-cli
```

## Usage

```sh
# Who knows this repo best?
git who

# Who knows a specific file best?
git who src/index.js

# Who knows a directory best?
git who src/

# Show top 10 contributors
git who -n 10
```

### Example output

```
git who src/utils.js ──────────────────────────────

  Last modified by Alice 2d ago (Wed, Mar 12, 2025)

  Top contributors:

  ★  Alice    █████████████████████ 63% lines  47 commits  2d ago
  2  Bob      ██████████           31% lines  23 commits  1w ago
  3  Charlie  ██                    6% lines   4 commits  3mo ago

  → Ask Alice — they own 63% of lines and made 47 commits
    or Bob (31% lines, 23 commits)
```

### Directory / repo-wide view

```
git who . ──────────────────────────────────────────

  Last modified by Alice 2d ago (Wed, Mar 12, 2025)

  Top contributors:

  ★  Alice    ██████████████████ 54% commits (127)  2d ago
  2  Bob      ████████████       36% commits (85)   3d ago
  3  Charlie  ███                10% commits (23)   2w ago

  → Ask Alice — 54% of commits (127 total)
    or Bob (36%, 85 commits)
```

## Features

- **File mode**: Uses `git blame` to find line ownership + `git log` for commit history
- **Directory mode**: Uses `git shortlog` for aggregate contributor stats
- **Smart ranking**: 60% line ownership + 40% commit frequency (file mode)
- **Beautiful output**: Color-coded bars, ranks, and "who to ask" suggestions
- **Fast**: Single-pass blame parsing, no external dependencies beyond git

## Requirements

- Node.js >= 18
- Git installed and accessible on your PATH

## License

MIT
