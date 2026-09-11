# Pitek 🐔

An **Eagle-style desktop asset manager**. Create a *library*, drag in your images, videos,
audio, and text files, and Pitek indexes them into a **tidy, human-readable folder** on disk —
thumbnails + JSON, no database.

![Pitek — grid view](docs/screenshots/01-grid.png)

> Unlike Eagle (which stores items in randomly-named `xxxx.info/` folders), Pitek keeps
> everything in flat, readable folders you can browse in Finder — grouped by the file name's
> first three letters.

## Features

**Libraries**
- Create / open a `<name>.pitek` library that holds your whole collection.
- Keep **multiple libraries** and switch between them from the sidebar; the last one reopens
  automatically on launch.
- Per-library actions: change icon, reveal in Finder, merge into another library, remove, delete.

**Importing**
- Drag-and-drop, a file picker, a whole **folder** (walked recursively), or **from a URL**.
- **Link / Reference import** — reference files *in place* without copying them into the
  library (saves disk space; the library keeps only the metadata + thumbnail).

**Media**
- **Images** — thumbnails via [sharp](https://sharp.pixelplumbing.com/) (WebP, ≤400px).
- **Video** — a poster frame is captured automatically for the thumbnail; plays in a built-in player.
- **Audio** — built-in player with a generated waveform-less poster.
- **Text / code** — opens in a VS Code-style editor (CodeMirror) with syntax highlighting.

**Organizing**
- **Multiple folders per item**, **tags** (with an *All Tags* page), and **smart folders**
  (saved filters).
- Views: **All**, **Uncategorized**, **Untagged**, **Recently Used**, **Random**, and a real **Trash**.
- A rich **filter bar** (type, color, shape, rating, dimensions, duration, size, dates, comment,
  note, URL…) and **search** with a configurable scope.
- **Find duplicates** by content hash.

**Viewing & editing**
- Grid layouts: **waterfall**, **justified**, **grid**, **list**, with a zoom slider and sort options.
- **Inspector** with rating, tags, folders, notes/URL, a color palette (hover a swatch for its
  coverage %), and full metadata.
- **Preview** (lightbox) with **rotate**, **flip**, **fit / actual size**, **crop**, and **next / previous**.

![Inspector & color palette](docs/screenshots/02-inspector.png)

![Preview with crop / rotate / flip toolbar](docs/screenshots/03-lightbox.png)

![Add menu — import & link options](docs/screenshots/04-add-menu.png)

## Library layout on disk

Everything for one item — its metadata JSON, the original, and the thumbnail — lives together
in a folder named after the file's **first three initials**. Files sharing initials share a folder:

```
MyLibrary.pitek/
├── library.json            # { name, version, createdAt, itemCount }
├── tags.json               # canonical tag list
├── filters.json            # smart folders (saved filters)
├── folders.json            # folders
├── pre/                     # bucket for names starting "pre"
│   ├── preview-l9x2ka.json  # one metadata file per item — this is the index
│   ├── preview-l9x2ka.png   # the original (omitted for Linked imports)
│   └── preview-l9x2ka.webp  # its thumbnail
└── mov/
    ├── movie-k1p8.json
    ├── movie-k1p8.mov
    └── movie-k1p8.webp
```

`<id>` is `<slug-of-name>-<base36-timestamp><rand>`, e.g. `preview-l9x2ka` — readable in Finder,
sortable, and collision-resistant. Older libraries (with the previous flat `items/` + `originals/`
+ `thumbnails/` layout) are **migrated automatically** the first time they're opened.

## Tech stack

- **Electron** with a strict, isolated renderer (`contextIsolation`, no `nodeIntegration`).
- **electron-vite** build (main / preload / renderer).
- **Svelte 5 + TypeScript** UI.
- **sharp** for image thumbnails, palette, and cropping.
- Assets are served to the UI over a custom `asset://` protocol (with HTTP Range support for
  video/audio streaming) — no `file://`, no `webSecurity` hacks.

## Run

Needs **Node.js** (this is not a static-server project — it has a build step).

```bash
npm install      # downloads Electron + sharp prebuilt binaries
npm run dev      # launches the Electron app with hot reload
```

Other scripts:

```bash
npm run build    # bundle main + preload + renderer into out/
npm run check    # svelte-check type checking (target: 0 errors / 0 warnings)
```

## Project structure

- **main** (`src/main/`) owns all filesystem access: `library.ts` (create/open/list/import/crop/
  delete + the per-bucket storage), `thumbnail.ts` (sharp), `config.ts` (remembers the last library
  and UI prefs), and `index.ts` (window, IPC handlers, `asset://` protocol, app icon).
- **preload** (`src/preload/`) exposes a small typed `window.rak` API over `contextBridge`.
- **renderer** (`src/renderer/`) is the Svelte UI: `Welcome`, `Sidebar`, `Toolbar`, `FilterBar`,
  `Grid`, `Inspector`, `Lightbox`, `MediaPlayer`, `CodeEditor`, `SearchPalette`, `TagsPage`, and more.

---

Part of the [one-day-one-code](https://github.com/FannyDevz) daily experiments — the one project
built as a real desktop app.
