# Building PartBench

The desktop app lives in this folder and leaves ScanRuler's own source alone
wherever it can, so merging upstream stays easy. Only `mcp/src/browser.js` and
`.gitignore` differ from upstream; `NOTICE.md` has the list.

## Build it

Needs Node.js 22 or newer on Windows. From the top of the repository:

```bash
npm ci
```

```bash
npm --prefix mcp ci
```

```bash
npm --prefix desktop ci
```

```bash
npm --prefix desktop run dist
```

The installer lands in `desktop/release/`. `npm --prefix desktop start` runs the
app from source after `npm --prefix desktop run page` has built the page.

## How it fits together

- **Electron** rather than Tauri: it brings its own Node, so the connector runs
  with nothing else installed, and its Chromium matches what ScanRuler is built
  and tested against. The cost is a larger download.
- **The page** is served from `http://127.0.0.1:7318/` by upstream's `serve.js`.
  The connector's origin check already allows any page on this computer, and a
  fixed address keeps the page's settings between runs.
- **The connector** is upstream's `mcp/`, run by the app's own executable with
  `ELECTRON_RUN_AS_NODE=1`. The app starts one copy to hold port 7317; the copies
  Claude Desktop starts relay through it, as upstream's `relay.js` already allows.
- **Pairing** uses the token in `%APPDATA%\scanruler-mcp\config.json`, shared with
  every copy of the connector, passed to the page as upstream's `#agent=` link.
- **The first-run data warning is the author's and is kept on purpose.** It takes
  one click and it tells people something true.
- **The start card** is added by `preload.cjs` in a shadow root, with no change to
  the page's source.
- **The name** changes at build time, in interface files only (`lib/rebrand.mjs`).

## Testing

```bash
npm --prefix desktop test
```

`scripts/smoke.mjs` runs a built app end to end on its own ports and config
folders: the window, pairing, the copy button, a copy of the Claude config, the
connector started as Claude Desktop starts it, a real project, a CAD kernel export
and saving. Its header has the command.

## Following upstream

`.github/workflows/desktop-follow-upstream.yml` runs daily. When upstream has new
commits it merges them, pushes, and starts `desktop-release.yml`, which runs the
tests and publishes an installer. Installed apps update from that release.

It opens an issue and stops in two cases:

- **A merge conflict.** Fix it by hand:

  ```bash
  git remote add upstream https://github.com/CNCKitchen/scanruler.git
  ```

  ```bash
  git fetch upstream
  ```

  ```bash
  git merge upstream/main
  ```

  Resolve the conflict, push, and run the workflow again.

- **Upstream changed its workflow files**, which GitHub doesn't let the automatic
  token push. Click **Sync fork** on the repository's front page, then run
  **Desktop release** under Actions.

GitHub pauses scheduled workflows after 60 days with no activity in a repository.
If updates stop, re-enable the workflow under Actions.

## If you rename it

Change the name in `package.json`, `electron-builder.yml`, `lib/rebrand.mjs`,
`main.cjs`, `preload.cjs` and `.github/README.md`.
