// SPDX-License-Identifier: AGPL-3.0-only
// Opening the pairing link in the user's default browser, so that
// scanruler_open can bring up a ScanRuler tab that is already paired with
// this server — nothing for the user to copy or click but the browser's own
// question whether the site may reach this computer.

import { spawn } from 'node:child_process'

/** A link safe to hand to the shell that opens it: http(s), and none of the
 *  characters cmd.exe reads inside quotes (`%`, `"`, `^`) or spaces. */
const SAFE = /^https?:\/\/[\w.:/#=?&~-]+$/

/** The program and its arguments that open `url` in the default browser. */
export function openCommand(url, platform = process.platform) {
  // `start` is cmd's; its first quoted argument is a window title, hence "".
  if (platform === 'win32') return { command: 'cmd', args: ['/d', '/c', 'start', '""', `"${url}"`], verbatim: true }
  if (platform === 'darwin') return { command: 'open', args: [url], verbatim: false }
  return { command: 'xdg-open', args: [url], verbatim: false }
}

/** Open `url` in the default browser. Resolves true once the opener has
 *  started — whether a browser came up is for the caller to find out (the
 *  page connecting) — and false when the link is not one to open or the
 *  opener could not be started. */
export function openInBrowser(url, platform = process.platform) {
  // PartBench change, 2026-11-05 (not in upstream ScanRuler): a connector that
  // came with the desktop app brings that app up instead of a browser tab.
  if (process.env.SCANRULER_MCP_DESKTOP_EXE) return openDesktopApp(process.env.SCANRULER_MCP_DESKTOP_EXE)
  if (!SAFE.test(url)) return Promise.resolve(false)
  const { command, args, verbatim } = openCommand(url, platform)
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true, windowsVerbatimArguments: verbatim })
    } catch {
      resolve(false)
      return
    }
    child.once('error', () => resolve(false))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}

/** PartBench change, 2026-11-05: start the desktop app, or bring up the one
 *  already running. Without ELECTRON_RUN_AS_NODE, which this server runs under,
 *  the same program starts as the app rather than as Node. */
function openDesktopApp(exe) {
  const { ELECTRON_RUN_AS_NODE: _node, ...env } = process.env
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(exe, [], { stdio: 'ignore', detached: true, windowsHide: false, env })
    } catch {
      resolve(false)
      return
    }
    child.once('error', () => resolve(false))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}
