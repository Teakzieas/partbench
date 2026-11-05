// SPDX-License-Identifier: AGPL-3.0-only
// PartBench: ScanRuler by Stefan Hermann (CNC Kitchen) in a desktop window, with
// its agent server built in. The page is served from 127.0.0.1 (by upstream's
// own serve.js) rather than from a file, because the server's origin check
// already allows any page on this computer, workers and wasm load as they do on
// the web, and a fixed address keeps the page's saved settings between runs.

const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } = require('electron')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const connector = require('./lib/connector.cjs')
const { Server } = require('./lib/server.cjs')

const APP_PORT = Number(process.env.PARTBENCH_APP_PORT || 7318)
const AGENT_PORT = Number(process.env.PARTBENCH_AGENT_PORT || process.env.SCANRULER_MCP_PORT || 7317)
const APP_URL = `http://127.0.0.1:${APP_PORT}/`
const FORK_URL = 'https://github.com/Teakzieas/partbench'
const UPSTREAM_URL = 'https://github.com/CNCKitchen/scanruler'

if (process.env.PARTBENCH_USER_DATA) app.setPath('userData', process.env.PARTBENCH_USER_DATA)

const dev = !app.isPackaged
const repo = join(__dirname, '..')
const serverJs = dev ? join(repo, 'mcp', 'bin', 'scanruler-mcp.js') : join(process.resourcesPath, 'mcp', 'bin', 'scanruler-mcp.js')
const mcpSrc = dev ? join(repo, 'mcp', 'src') : join(process.resourcesPath, 'mcp', 'src')
const pageDir = dev ? join(repo, 'dist-desktop') : join(process.resourcesPath, 'page')
const outDir = join(app.getPath('documents'), 'PartBench')

/** The one prompt. It names the tools rather than the connector, so it works
 *  with any copy of the connector the person's Claude has. */
const PROMPT = `Let's work in PartBench using the ScanRuler tools. Call scanruler_status first, and if no page is connected call scanruler_open, which brings up the PartBench app. Read the right guide with guide_read and check session_state. Then tell me what you see and ask me what we're working on.`

let win = null
let server = null
let updateState = { state: 'idle' }

const entry = () => connector.entryFor({ exe: process.execPath, serverJs, appUrl: APP_URL, outDir })
const send = (channel, value) => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, value)
}

/** What the start card shows. */
async function currentStatus() {
  const file = connector.configPath()
  let link = { server: false, page: false }
  try {
    const answer = await server?.status()
    if (answer) {
      // The connection may belong to a ScanRuler tab in a browser rather than
      // this window, and only one page can have it at a time.
      const ours = answer.page?.origin === new URL(APP_URL).origin
      link = { server: true, role: answer.server?.role, page: answer.connected === true && ours, otherPage: answer.connected === true && !ours ? answer.page?.origin : null }
    }
  } catch {}
  return {
    prompt: PROMPT,
    version: app.getVersion(),
    forkUrl: FORK_URL,
    upstreamUrl: UPSTREAM_URL,
    link,
    claude: { file, ...connector.status(file, entry()) },
    update: updateState,
  }
}

/** Ask, then add the connector to Claude Desktop's config. */
async function addConnector() {
  const file = connector.configPath()
  const { state, stock } = connector.status(file, entry())
  if (state === 'unreadable') {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'PartBench',
      message: 'Claude Desktop’s config file could not be read',
      detail: `${file}\n\nIt is not valid JSON, so PartBench has left it alone. Fix it in Claude Desktop under Settings → Developer → Edit Config, then try again.`,
    })
    return false
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Add to Claude Desktop',
    message: 'Add the PartBench connector to Claude Desktop?',
    detail:
      `This changes one section of:\n${file}\n\n` +
      `• Adds a connector named "${connector.SERVER_KEY}" that runs from this app.\n` +
      (stock ? `• Removes your "${connector.STOCK_KEY}" connector (npx scanruler-mcp), which would duplicate the same tools and open a browser tab instead of this app.\n` : '') +
      '• Everything else stays the same, and a backup copy is saved next to the file first.\n\n' +
      'Afterwards, quit Claude Desktop fully (File → Exit) and open it again.',
    buttons: ['Add connector', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response !== 0) return false
  mkdirSync(outDir, { recursive: true })
  try {
    connector.add(file, entry())
    return true
  } catch (error) {
    await dialog.showMessageBox(win, { type: 'error', title: 'PartBench', message: 'The connector could not be added', detail: error.message })
    return false
  }
}

function startUpdates() {
  // Only an installed copy updates; a run from source has nothing to replace.
  if (dev || process.env.PARTBENCH_NO_UPDATE) return
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = true
  // Installed when the app next closes, or at once if the person asks. Never
  // restarted on its own: there may be unsaved work.
  autoUpdater.autoInstallOnAppQuit = true
  const report = (state) => {
    updateState = state
    send('partbench:update', state)
  }
  autoUpdater.on('update-available', (info) => report({ state: 'downloading', version: info.version }))
  autoUpdater.on('update-downloaded', (info) => report({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (error) => {
    // No release yet, or offline: not worth interrupting anyone for.
    console.error('Update check failed:', error.message)
    report({ state: 'idle' })
  })
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000).unref()
  ipcMain.handle('partbench:install-update', () => autoUpdater.quitAndInstall())
}

function createWindow(pairing) {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    title: 'PartBench',
    icon: join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  // Links open in the person's browser; the window itself stays on the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(APP_URL)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(APP_URL)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })
  // The page asks before closing with unsaved work. In a browser the browser
  // shows that question; Electron leaves it to the app, and without this the
  // window would simply refuse to close.
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      title: 'PartBench',
      message: 'You have unsaved work',
      detail: 'Close PartBench anyway? PartBench keeps a recovery copy, but save your project if you want to be sure.',
      buttons: ['Close anyway', 'Keep working'],
      defaultId: 1,
      cancelId: 1,
    })
    if (choice === 0) event.preventDefault()
  })
  // Downloads get the normal Save As dialog; the automated test has nobody to
  // answer it, so it names a folder instead (scripts/smoke.mjs).
  if (process.env.PARTBENCH_TEST_DOWNLOADS) {
    win.webContents.session.on('will-download', (_event, item) => item.setSavePath(join(process.env.PARTBENCH_TEST_DOWNLOADS, item.getFilename())))
  }
  win.on('closed', () => {
    win = null
  })
  win.loadURL(`${APP_URL}#agent=${AGENT_PORT}:${pairing}`)
}

async function main() {
  // Upstream's own modules: the pairing token every copy of the connector
  // shares, and the static server.
  const { loadConfig } = await import(pathToFileURL(join(mcpSrc, 'config.js')).href)
  const { httpServer } = await import(pathToFileURL(join(mcpSrc, 'serve.js')).href)
  const token = process.env.SCANRULER_MCP_TOKEN || loadConfig().token

  const http = httpServer({ serve: pageDir, version: app.getVersion() })
  await new Promise((resolve, reject) => {
    http.once('error', reject)
    http.listen(APP_PORT, '127.0.0.1', resolve)
  }).catch((error) => {
    dialog.showErrorBox('PartBench could not start', `Port ${APP_PORT} on this computer is in use by another program.\n\n${error.message}`)
    app.exit(1)
  })

  mkdirSync(outDir, { recursive: true })
  const { args, env } = entry()
  server = new Server({ exe: process.execPath, serverJs, args: [...args.slice(1), '--port', String(AGENT_PORT)], env })
  server.on('log', (text) => process.stderr.write(text))
  server.start().catch((error) => console.error(error.message))

  Menu.setApplicationMenu(null)
  createWindow(token)
  startUpdates()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Opened again, or scanruler_open called from Claude: bring this window up.
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  ipcMain.handle('partbench:status', () => currentStatus())
  ipcMain.handle('partbench:add-connector', () => addConnector())
  ipcMain.handle('partbench:copy', (_event, text) => clipboard.writeText(String(text)))
  ipcMain.handle('partbench:open', (_event, url) => {
    if (url === FORK_URL || url === UPSTREAM_URL) shell.openExternal(url)
  })
  app.whenReady().then(main)
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => server?.stop())
}
