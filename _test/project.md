# Obsidian Web Reader — Project Spec

## What
A self-hosted web reader for Obsidian vaults. Dark, minimal, hardware-inspired UI. Read and write raw markdown files. No plugins, no sync — just the text.

## Design: Teenage Engineering K.O.II Aesthetic

### Colors
- Background: #0d0d0d (near-black)
- Surface: #1a1a1a (panels)
- Border: #2a2a2a (subtle dividers)
- Text primary: #e8e8e8 (off-white)
- Text secondary: #888888 (muted)
- Accent amber: #ffb000 (primary actions)
- Accent cyan: #00e5cc (secondary)
- Accent magenta: #ff2d6a (highlight)
- Accent green: #39ff14 (success/active)

### Typography
- Font: JetBrains Mono (Google Fonts or bundled)
- Size: 14px base, 12px secondary
- No serif, no sans-serif — mono only

### UI Style
- Flat panels, no gradients
- Sharp corners everywhere (0px border-radius)
- 1px solid borders in #2a2a2a
- Hover: subtle glow (box-shadow with accent color at 20% opacity)
- Active/selected: accent color left border or background tint

## Layout

```
┌─────────────────────────────────────────────────────┐
│ [☰] OBSIDIAN READER          [vault name]           │  ← header
├──────────────┬──────────────────────────────────────┤
│  [search]    │  filename.md              [saved ✓] │  ← toolbar
│              │  ────────────────────────────────────  │
│  📁 Folder A │                                      │
│    file1.md  │  Raw markdown content...             │
│    file2.md  │  Multiple lines, scrollable          │
│  📁 Folder B │  Editor feels like terminal          │
│    file3.md  │                                      │
│              │                                      │
├──────────────┴──────────────────────────────────────┤
│ [status: /path/to/current/file.md]                   │
└─────────────────────────────────────────────────────┘
```

- Sidebar: 25% width, collapsible via ☰ icon, draggable resizer on right edge
- Editor: remaining 75%, filename header + scrollable content
- Status bar: bottom, current file path, terminal-style (`$ cat /path/to/file.md`)

## Features

1. **File tree** — read vault folder structure, folders expandable/collapsible
2. **Live search** — input filters file list by filename AND content (case-insensitive)
3. **Markdown editor** — raw text, textarea with monospace font, no WYSIWYG
4. **Auto-save** — save on Ctrl+S or blur from textarea
5. **Hide sidebar** — ☰ icon toggles sidebar visibility, icon stays
6. **Vault selector** — point to any folder, works with mockup or real vault
7. **Resizable sidebar** — drag handle on sidebar edge, min 15% / max 50% width, touch-friendly hit area (min 20px wide)
8. **Terminal aesthetic** — editor feels like a terminal: cursor blink, blinking cursor on textarea, command-line style status bar
9. **Mobile-first layout** — single column on small screens, sidebar as overlay drawer, touch-optimized tap targets (min 44px)
10. **Consistent iconography** — no emoji anywhere. Use simple ASCII/Unicode characters styled as mono text: `▶` for folders, `─` for files, `×` for close, `☰` for menu. All icons use same font/color as surrounding text
11. **Preview toggle** — button in toolbar to show/hide a rendered markdown preview pane alongside the editor. Toggle state persists. Preview uses a simple markdown-to-HTML render (no external lib, basic regex replacements for headers/lists/links/bold/italic/code). Preview pane takes 40% width, editor 60%.
12. **Mobile search fix** — In mobile/vertical view: clicking search input does NOT hide the sidebar overlay. Search input stays visible at top of screen. Folder tree remains accessible via ☰ button. Search results overlay the content rather than replacing it.

## Tech Stack

- **Backend**: Python FastAPI, single endpoint for file operations
- **Frontend**: Vanilla HTML + JS, no framework (keep it minimal)
- **Docker**: Single container, serves both backend and static frontend
- **Port**: 3000

## API Endpoints

```
GET  /api/files          → list all files recursively, with folder structure
GET  /api/file?path=X   → read file content
PUT  /api/file?path=X   → write file content (body = content)
GET  /api/vault-name     → vault folder name
```

## Docker

- Container name: `obsidian-reader`
- Image: custom `Dockerfile` (Python FastAPI + nginx for static)
- Mount: vault folder to `/vault` inside container
- Port: 3001 (publish to all interfaces for local network testing: `0.0.0.0:3001`)
- Network: binds to `0.0.0.0` so other devices on LAN can access for testing
- No auth for now, open to local network

## Mockup Data

Vault path: `/home/hb2d/obsidian/WebReader/_test/`

Structure:
```
_test/
  notes/
    meeting-2026-04-20.md
    project-ideas.md
    reading-list.md
  logs/
    daily-2026-04-27.md
  .metadata/
    vault-config.md
```

## Verification

1. `docker build` succeeds
2. `docker run` starts on port 3001
3. File tree loads in browser
4. Clicking a file shows content in editor
5. Editing and saving persists to mounted folder
6. Search filters file list correctly
7. Sidebar hides/shows
8. Sidebar is resizable via drag handle
9. Folders expand/collapse on click
10. Status bar shows terminal-style path
11. No emoji used anywhere — all icons are ASCII/Unicode mono characters
12. Mobile layout: sidebar becomes overlay drawer, tap targets ≥44px
13. Preview toggle shows/hides markdown preview pane (40/60 split)
14. Mobile search: search input visible, sidebar stays accessible via ☰

## Out of Scope (v1)
- WikiLinks [[]] autocomplete
- Live preview/split view
- Multiple vaults
- User auth
- TLS
