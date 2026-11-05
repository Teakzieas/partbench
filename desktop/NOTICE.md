# PartBench notice

PartBench is an **unofficial** desktop build of
[ScanRuler](https://github.com/CNCKitchen/scanruler), created by **Stefan
Hermann (CNC Kitchen)**. All of the measuring, fitting, modelling and
reverse-engineering work in this app is theirs. PartBench adds a window, an
installer and an easier way to connect Claude. It is not made, reviewed or
endorsed by Stefan Hermann or CNC Kitchen, so please report problems with this
build to [this project](https://github.com/Teakzieas/partbench/issues), not to
them.

If you find this useful, please consider supporting the original author at
<https://ko-fi.com/cnckitchen>.

## Licence

ScanRuler and this modified version are licensed under the **GNU AGPL-3.0-only**
(`LICENSE-AGPL-3.0.txt` in this folder). You may use, change and share it. If you
pass it on or run a changed version for others over a network, you must offer
them the complete source of your version under the same licence.

The complete source of this version:
<https://github.com/Teakzieas/partbench>

## The name

The ScanRuler and CNC Kitchen names and logo are trademarks of their owner and
are not licensed under the AGPL. Upstream's `COMMERCIAL.md` asks that forks use a
different name, which is why this build is called PartBench and has its own icon.
ScanRuler is named here only to credit the author and to say where the software
comes from. The name still appears inside the tools Claude uses (such as
`scanruler_status`) and in project files, so that `.scanruler` projects open in
both apps.

## What was changed from upstream

Changes began on 5 November 2026.

- `desktop/` (new): the Electron window, the installer setup, the start card, the
  Claude Desktop connector setup, updates, and a build step that changes the
  visible product name.
- `.github/README.md`, `.github/workflows/desktop-*.yml` (new): this project's
  front page, and the automation that follows upstream and publishes releases.
- `mcp/src/browser.js` (changed): when the connector is started by the desktop
  app, `scanruler_open` brings up the app rather than a browser tab.
- `.gitignore` (changed): ignores the desktop build's output.

## Third-party parts

These stay under their own licences, unchanged by the AGPL or by this build:

- **Open CASCADE Technology**, the CAD kernel used by the Reverse engineer
  workspace, is under the LGPL-2.1 with the Open CASCADE exception. It ships as a
  separate file in `resources/page/assets` that can be replaced. Its notice and a
  pointer to its source are in the app, under the workspace's notices. Source:
  <https://dev.opencascade.org/>, and for the WebAssembly build,
  <https://github.com/andymai/occt-wasm>.
- **Barlow, Barlow Semi Condensed and B612 Mono** fonts are under the SIL OFL 1.1
  (`resources/page/fonts`).
- **Electron** and the other dependencies are under their own open source
  licences (`LICENSE.electron.txt` and `LICENSES.chromium.html` beside the app).
