// SPDX-License-Identifier: AGPL-3.0-only
// Registering the bundled connector with Claude Desktop, which starts local
// connectors from the mcpServers list in claude_desktop_config.json. Nothing
// here runs on its own: main.cjs calls add() only after the person has said yes
// to a dialog showing the change. Everything else in the file (Claude Desktop
// keeps its preferences there too) is left as it was, and a backup is made.

const { copyFileSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SERVER_KEY = 'partbench'
/** The entry the npm connector's own setup instructions use. It would offer the
 *  same tools a second time and open a browser tab rather than this app. */
const STOCK_KEY = 'scanruler'

/** Where Claude Desktop keeps its config on Windows: the normal install, or the
 *  Microsoft Store one, whose files live in a private copy of AppData. */
function configPath({ env = process.env } = {}) {
  if (env.PARTBENCH_CLAUDE_CONFIG) return env.PARTBENCH_CLAUDE_CONFIG
  const normal = join(env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json')
  if (existsSync(normal)) return normal
  const packages = join(env.LOCALAPPDATA ?? '', 'Packages')
  try {
    for (const name of readdirSync(packages)) {
      if (!/^(Anthropic\.)?Claude/i.test(name)) continue
      const store = join(packages, name, 'LocalCache', 'Roaming', 'Claude', 'claude_desktop_config.json')
      if (existsSync(store)) return store
    }
  } catch {}
  return normal
}

/** The entry for this copy of the app. Electron's own Node runs the server, so
 *  nobody needs Node installed. */
function entryFor({ exe, serverJs, appUrl, outDir }) {
  return {
    command: exe,
    args: [serverJs, '--no-update', '--app', appUrl, '--out', outDir],
    env: { ELECTRON_RUN_AS_NODE: '1', SCANRULER_MCP_DESKTOP_EXE: exe },
  }
}

const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) : {})

/** 'current', 'outdated' (it points at another copy of the app), 'absent', or
 *  'unreadable' (the file is not valid JSON, and is not touched). `stock` says
 *  the npm connector is set up as well. */
function status(file, entry) {
  let config
  try {
    config = read(file)
  } catch {
    return { state: 'unreadable', stock: false }
  }
  const servers = config.mcpServers ?? {}
  const stock = STOCK_KEY in servers
  const have = servers[SERVER_KEY]
  if (!have) return { state: 'absent', stock }
  const same = have.command === entry.command && have.args?.[0] === entry.args[0]
  return { state: same ? 'current' : 'outdated', stock }
}

/** Add this app's entry and take out the npm one, after a backup. Returns the
 *  backup's path, or null when there was no file to back up. Throws, having
 *  changed nothing, on a file that is not valid JSON. */
function add(file, entry, { now = Date.now } = {}) {
  const config = read(file)
  if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error('The config file is not a JSON object.')
  let backup = null
  if (existsSync(file)) {
    backup = `${file}.partbench-backup-${now()}`
    copyFileSync(file, backup)
  }
  const servers = { ...(config.mcpServers ?? {}) }
  delete servers[STOCK_KEY]
  servers[SERVER_KEY] = entry
  const temp = `${file}.partbench-tmp`
  writeFileSync(temp, `${JSON.stringify({ ...config, mcpServers: servers }, null, 2)}\n`)
  renameSync(temp, file)
  return backup
}

module.exports = { SERVER_KEY, STOCK_KEY, add, configPath, entryFor, status }
