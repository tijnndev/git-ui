# Git UI

A lightweight, self-contained Git client built with [Tauri v2](https://tauri.app/) (Rust backend + React/TypeScript frontend). Designed for developers who manage multiple GitHub repositories across different accounts or organisations, without relying on system credential helpers or a browser-based OAuth flow.

---

## Features

### Repository management
- Open any local Git repository via a folder picker or by dragging a path
- Pin frequently-used repositories to the top of the welcome screen
- Assign repositories to **categories** (colour-coded groups, each with its own GitHub account) so the right credentials are always used automatically

### Commit graph
- Visualised with D3.js — shows all branches as coloured lanes with merge lines
- Columns: commit message, author, date, short hash (each individually toggleable)
- Click any commit to inspect its diff, changed files, and full metadata
- Cherry-pick, revert, create a tag, or copy the hash from the commit detail panel

### Branching
- Create branches from any commit or existing branch
- Checkout local branches with a single click
- **Right-click any branch** in the sidebar for the full action menu:
  - Push / Force-push to origin
  - Rename
  - Merge into current branch
  - Squash-merge into current branch
  - Rebase current branch onto this branch
  - Delete

### Working directory
- Stage / unstage individual files or all changes at once
- Inline unified diff viewer with syntax-aware line colouring
- Commit with a message, or amend the last commit
- Discard changes per file

### Remote operations
- Pull (merges the tracked upstream branch — not the remote's default branch)
- Push with ahead/behind indicators per branch
- Force-push with `--force-with-lease`
- Fetch individual remotes or all remotes at once
- Add / remove remotes
- Delete remote branches
- Push tags individually or all at once

### Stash
- Save the working directory to a stash with a message
- Pop, apply, or drop individual stash entries

### Authentication
- Store multiple GitHub accounts (Personal Access Tokens — classic or fine-grained)
- Assign an account to a category; every repository in that category uses it automatically
- Credentials are injected directly into HTTPS remote URLs at call time using git's `url.<auth>.insteadOf` mechanism — no credential helper, no interactive terminal prompt
- Settings and accounts persist across app updates via `tauri-plugin-store`

### Appearance & settings
- Fully customisable dark theme — edit any colour token from the Settings panel
- Adjust graph row height, lane width, font sizes, and max commit count
- Custom CSS field for arbitrary overrides

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 18 + TypeScript, Vite |
| Git operations | libgit2 via `git2-rs` (index, diff, log, branches, tags, stash) |
| Network ops | Git CLI (`push`, `pull`, `fetch`) — spawned with `CREATE_NO_WINDOW` |
| Commit graph | D3.js |
| Icons | Lucide React |
| Persistence | `tauri-plugin-store` (JSON file, survives dev↔prod origin changes) |
| Virtualised lists | `react-window` |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for your OS
- Git installed and on `PATH` (required for push/pull/fetch)

---

## Development

```bash
# Install frontend dependencies
npm install

# Start the app in dev mode (hot-reload frontend + Rust rebuild on change)
npm run tauri dev
```

The Vite dev server runs on `http://localhost:1420`. Tauri opens the native window pointing at it.

---

## Building

```bash
# Produce an optimised installer for your platform
npm run tauri build
```

Output is placed in `src-tauri/target/release/bundle/`. On Windows this produces an `.msi` and a `.exe` NSIS installer.

The release profile uses `opt-level = "s"`, LTO, and `codegen-units = 1` for a minimal binary size.

---

## Project structure

```
git-ui/
├── src/                        # React frontend
│   ├── components/
│   │   ├── CommitGraph.tsx     # D3 lane graph
│   │   ├── CommitDetail.tsx    # Diff & metadata panel
│   │   ├── DiffViewer.tsx      # Unified diff renderer
│   │   ├── Sidebar.tsx         # Branches / tags / remotes / stash
│   │   ├── WorkingDirectory.tsx# Staging area & commit form
│   │   ├── SettingsPanel.tsx   # App settings & account management
│   │   └── WelcomeScreen.tsx   # Repo list, categories, open/clone
│   ├── github-accounts.ts      # PAT storage & URL credential injection
│   ├── settings.ts             # AppSettings schema & defaults
│   ├── api.ts                  # Typed wrappers around Tauri commands
│   ├── store.ts                # tauri-plugin-store helpers
│   └── types.ts                # Shared TypeScript interfaces
├── src-tauri/
│   ├── src/
│   │   ├── commands.rs         # Tauri command handlers (push/pull/fetch + auth)
│   │   ├── git_ops.rs          # libgit2 operations
│   │   ├── models.rs           # Serde structs shared with frontend
│   │   └── lib.rs              # Tauri builder & command registration
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

---

## GitHub account setup

1. Generate a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope (classic) or the specific repository permissions you need (fine-grained).
2. Open **Settings → GitHub Accounts** inside the app and add the token with a label (e.g. *work*, *personal*).
3. Create a **category** (Settings → Categories) and assign the account to it.
4. On the welcome screen, assign each repository to the appropriate category.

Push, pull, and fetch for that repository will now use the linked token automatically.
