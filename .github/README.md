# PartBench

**An unofficial Windows desktop build of [ScanRuler](https://github.com/CNCKitchen/scanruler), with a built-in Claude connector.**

> ### All credit to the original author
>
> ScanRuler was created by **Stefan Hermann (CNC Kitchen)**. Everything that measures, fits, models and reverse engineers in this app is their work. This project only adds a desktop window, an installer and an easier way to connect Claude.
>
> PartBench is not made, reviewed or endorsed by Stefan Hermann or CNC Kitchen, so please report problems with this build [here](https://github.com/Teakzieas/partbench/issues), not to them.
>
> If you find it useful, please [support the original author](https://ko-fi.com/cnckitchen) and try the [original at scanruler.com](https://scanruler.com/).

## Install

1. Download `PartBench-Setup-….exe` from the [latest release](https://github.com/Teakzieas/partbench/releases/latest) and run it.
2. The installer isn't code-signed, so Windows may say "Windows protected your PC". Choose **More info**, then **Run anyway**. Only do this if you downloaded it from this page.

It installs for your Windows user only, with no administrator rights needed. You don't need Node.js or a browser.

## Start working with Claude

The first time:

1. Open PartBench. Accept the data warning, which explains that what Claude reads goes to Anthropic.
2. On the **Start with Claude** card, click **Add to Claude Desktop**. It shows you the change and makes a backup first.
3. Quit Claude Desktop fully (**File → Exit**, since closing the window leaves it running) and open it again.

After that, every time:

1. Open PartBench.
2. Click **Copy prompt** and paste it into a Claude Desktop chat.

## Updates

- **Following ScanRuler:** once a day this repository checks the original project. If there's anything new, it merges it and builds a new installer.
- **In the app:** PartBench checks for new releases, downloads them in the background and installs them when you close it. It never restarts by itself.

If an upstream change conflicts with this project's changes, the automation stops and opens an issue here instead of guessing. New versions reach this app after they reach the public ScanRuler repository, which can be later than scanruler.com.

## What works, and what doesn't

- It connects to **Claude Desktop** and **Claude Code**, because both can start a program on your computer. It can't connect to Claude in a web browser (claude.ai): custom connectors there run from Anthropic's servers, which can't reach your computer.
- Windows only for now.
- Your `.scanruler` project files open in both this app and scanruler.com, as long as neither one is older than the version that saved the file.

## Licence

**GNU AGPL-3.0-only**, the same as ScanRuler. See [LICENSE](../LICENSE).

- You may use, change and share this software freely.
- If you share it, or run a changed version for other people over a network, you must offer them the complete source of your version under the same licence.
- The **ScanRuler and CNC Kitchen names and logo are trademarks** and aren't covered by the licence. The original project [asks that forks use a different name](../COMMERCIAL.md), which is why this one is called PartBench and has its own icon.

[desktop/NOTICE.md](../desktop/NOTICE.md) lists what was changed from the original and the third-party parts, such as the Open CASCADE CAD kernel. Building it yourself is covered in [desktop/README.md](../desktop/README.md).

The original project's own documentation is in the [main README](../README.md).
