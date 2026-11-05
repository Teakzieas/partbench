// SPDX-License-Identifier: AGPL-3.0-only
// End-to-end check of a built app, on its own ports and config folders so that
// it cannot touch a real session. It drives the real window, and starts the
// connector exactly as Claude Desktop would, from the entry the app would write.
//
//   node desktop/scripts/smoke.mjs <PartBench.exe> <project.scanruler> <work folder>
//
// The project is opened and never written to; the script checks its hash after.
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const [exeArg, project, work] = process.argv.slice(2)
const exe = resolve(exeArg)
const here = new URL('.', import.meta.url)
const mcpModules = new URL('../../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/', here)
const { Client } = await import(new URL('index.js', mcpModules).href)
const { StdioClientTransport } = await import(new URL('stdio.js', mcpModules).href)
const connector = createRequire(import.meta.url)('../lib/connector.cjs')

const APP_PORT = 7418
const AGENT_PORT = 7417
const DEBUG_PORT = 9333
const dirs = { config: join(work, 'mcp-config'), data: join(work, 'user-data'), downloads: join(work, 'downloads'), shots: join(work, 'shots') }
Object.values(dirs).forEach((d) => mkdirSync(d, { recursive: true }))
const claudeConfig = join(work, 'claude_desktop_config.json')
const env = {
  ...process.env,
  PARTBENCH_APP_PORT: String(APP_PORT),
  PARTBENCH_AGENT_PORT: String(AGENT_PORT),
  SCANRULER_MCP_PORT: String(AGENT_PORT),
  SCANRULER_MCP_CONFIG_DIR: dirs.config,
  PARTBENCH_USER_DATA: dirs.data,
  PARTBENCH_CLAUDE_CONFIG: claudeConfig,
  PARTBENCH_NO_UPDATE: '1',
  PARTBENCH_TEST_DOWNLOADS: dirs.downloads,
}

let failed = 0
const ok = (what, detail = '') => console.log(`PASS  ${what}${detail ? `: ${detail}` : ''}`)
const check = (cond, what, detail = '') => {
  if (cond) return ok(what, detail)
  failed++
  console.log(`FAIL  ${what}${detail ? `: ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const until = async (fn, ms, what) => {
  const end = Date.now() + ms
  let last
  while (Date.now() < end) {
    try {
      last = await fn()
      if (last) return last
    } catch (e) {
      last = e
    }
    await sleep(500)
  }
  throw new Error(`Timed out waiting for ${what} (${last?.message ?? last})`)
}
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const launch = () => spawn(exe, [`--remote-debugging-port=${DEBUG_PORT}`], { env, stdio: 'ignore' })
const pageOf = async () =>
  until(async () => {
    const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DEBUG_PORT}`, defaultViewport: null })
    const page = (await browser.pages()).find((p) => p.url().startsWith(`http://127.0.0.1:${APP_PORT}/`))
    if (!page) {
      browser.disconnect()
      return null
    }
    return { browser, page }
  }, 45_000, 'the app window')
const card = (page, js) => page.evaluate(`(() => { const r = document.getElementById('partbench-start')?.shadowRoot; const $ = (id) => r?.getElementById(id); return (${js}) })()`)

const originalHash = hash(project)
const consoleErrors = []

// ---- the app starts, shows the card, and pairs ------------------------------
let app = launch()
let { browser, page } = await pageOf()
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(String(e)))
await page.waitForSelector('[data-test=app-version]', { timeout: 45_000 })
await until(() => card(page, "$('prompt')?.value"), 10_000, 'the prompt')
ok('app launched, page loaded', await page.$eval('[data-test=app-version]', (e) => e.textContent))
check((await page.title()) === 'PartBench', 'window title is the fork’s name', await page.title())
check(/Based on ScanRuler by CNC Kitchen/.test(await page.$eval('.brand', (e) => e.textContent)), 'top bar credits the author')
check(!(await page.evaluate(() => location.hash)), 'pairing link taken back out of the address')
await page.screenshot({ path: join(dirs.shots, '1-first-run.png') })
await page.waitForSelector('[data-test=agent-data-warning]', { timeout: 15_000 })
ok('author’s first-run data warning is shown, not bypassed')
await page.screenshot({ path: join(dirs.shots, '2-warning.png') })
await page.evaluate(() => [...document.querySelectorAll('[data-test=agent-data-warning] .modalfoot button')].at(-1).click())
await until(() => card(page, "$('linkText').textContent.includes('paired')"), 30_000, 'the card to say paired')
ok('app paired with its own connector with no manual steps')

// ---- the prompt copies ------------------------------------------------------
const prompt = await card(page, "$('prompt').value")
let saved = ''
try {
  saved = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' })
} catch {}
await card(page, "$('copy').click()")
await sleep(500)
const pasted = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' }).trim()
check(pasted === prompt, 'Copy button puts the prompt on the clipboard')
if (saved) execFileSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value $input'], { input: saved })
await page.screenshot({ path: join(dirs.shots, '3-paired.png') })

// ---- registering with Claude Desktop, on a copy of the config ---------------
const realConfig = join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
if (existsSync(realConfig)) copyFileSync(realConfig, claudeConfig)
const before = existsSync(claudeConfig) ? JSON.parse(readFileSync(claudeConfig, 'utf8')) : {}
const serverJs = join(exe, '..', 'resources', 'mcp', 'bin', 'scanruler-mcp.js')
const entry = connector.entryFor({ exe, serverJs, appUrl: `http://127.0.0.1:${APP_PORT}/`, outDir: join(process.env.USERPROFILE, 'Documents', 'PartBench') })
const backup = connector.add(claudeConfig, entry)
const after = JSON.parse(readFileSync(claudeConfig, 'utf8'))
const { mcpServers: a, ...restAfter } = after
const { mcpServers: b, ...restBefore } = before
check(JSON.stringify(restAfter) === JSON.stringify(restBefore), 'connector setup keeps every other setting')
check(after.mcpServers.partbench && !after.mcpServers.scanruler, 'connector setup adds partbench, removes the npm entry')
check(!backup || hash(backup) === hash(realConfig), 'connector setup leaves a backup')
await until(() => card(page, "$('claudeText').textContent.includes('has the connector')"), 10_000, 'the card to see the connector')
ok('card sees the connector in the config')

// ---- the connector, started as Claude Desktop starts it ---------------------
const startConnector = async () => {
  const listed = after.mcpServers.partbench
  const transport = new StdioClientTransport({
    command: listed.command,
    args: listed.args,
    env: { ...env, ...listed.env },
    stderr: 'ignore',
  })
  const client = new Client({ name: 'claude-desktop-stand-in', version: '1' })
  await client.connect(transport)
  const call = async (name, input = {}) => {
    const r = await client.callTool({ name, arguments: input }, undefined, { timeout: 300_000 })
    const text = r.content?.find((c) => c.type === 'text')?.text ?? ''
    if (r.isError) throw new Error(`${name}: ${text}`)
    let json = null
    try {
      json = JSON.parse(text)
    } catch {}
    return { json, text, images: r.content?.filter((c) => c.type === 'image') ?? [] }
  }
  return { client, call }
}
let { client, call } = await startConnector()
const tools = (await client.listTools()).tools.map((t) => t.name)
check(tools.includes('scanruler_status') && tools.includes('project_load'), 'connector lists the tools', `${tools.length} tools`)
let status = (await until(async () => {
  const s = await call('scanruler_status')
  return s.json.connected ? s : null
}, 20_000, 'the connector to see the page')).json
check(status.server.role === 'relay', 'Claude’s copy shares the app’s connection', `role=${status.server.role}, server ${status.server.version}`)
check(status.page.plugins.includes('reverse') && status.page.plugins.includes('mesh-tools'), 'plugins present', status.page.plugins.join(', '))
check(status.page.origin === `http://127.0.0.1:${APP_PORT}`, 'page is the desktop app', status.page.origin)

// ---- a real project, through the page's own file input and through the tools -
const input = await page.$('[data-test=project-input]')
await input.uploadFile(project)
const opened = await until(async () => {
  const s = (await call('session_state')).json
  return s.scan && !s.busy && (s.elements?.length ?? 0) > 0 ? s : null
}, 180_000, 'the project to open from the file input')
ok('opened the project through the page’s file input', `${opened.scan.file}, ${opened.elements.length} elements`)
await sleep(1500)
await page.screenshot({ path: join(dirs.shots, '4-project.png') })

const loaded = await call('project_load', { path: project, discard: true })
const state = await until(async () => {
  const s = (await call('session_state')).json
  return s.scan && !s.busy && s.elements?.length > 0 ? s : null
}, 180_000, 'the project to load through the connector')
check(state.elements.length === opened.elements.length, 'opened the same project through the connector', `${state.elements.length} elements`)
void loaded

// The tools the copied prompt names.
check((await call('guide_read', {})).text.length > 100, 'guide_read answers, as the prompt asks')

const picture = await call('view_render', {})
check(picture.images.length === 1 && picture.images[0].data.length > 10_000, '3D view renders (WebGL)', `${picture.images[0]?.data.length ?? 0} base64 chars`)
if (picture.images[0]) writeFileSync(join(dirs.shots, '5-view-render.png'), Buffer.from(picture.images[0].data, 'base64'))

// Open CASCADE (wasm) in a worker.
const stepTool = tools.find((t) => t === 'export_step')
const stepFile = join(work, 'smoke-export.step')
try {
  await call(stepTool, { path: stepFile })
} catch (e) {
  console.log(`      export_step said: ${e.message.slice(0, 200)}`)
}
check(existsSync(stepFile) && statSync(stepFile).size > 100, 'export_step wrote a file through the connector', existsSync(stepFile) ? `${statSync(stepFile).size} bytes` : 'none')
const cadFile = join(work, 'smoke-reverse.step')
try {
  const cad = await call('reverse_export_step', { path: cadFile })
  console.log(`      reverse_export_step said: ${cad.text.slice(0, 200)}`)
} catch (e) {
  console.log(`      reverse_export_step said: ${e.message.slice(0, 300)}`)
}
check(existsSync(cadFile) && statSync(cadFile).size > 1000, 'CAD kernel (Open CASCADE wasm) exported a STEP body', existsSync(cadFile) ? `${statSync(cadFile).size} bytes` : 'none')

const savedProject = join(work, 'smoke-saved.scanruler')
await call('project_save', { path: savedProject })
check(existsSync(savedProject) && statSync(savedProject).size > 1000, 'project_save wrote elsewhere', existsSync(savedProject) ? `${statSync(savedProject).size} bytes` : 'none')

// The page's own Save button makes a download; the app gets it.
await page.click('[data-test=save-project]')
await until(() => readdirSync(dirs.downloads).some((f) => f.endsWith('.scanruler')), 90_000, 'the page’s Save to download')
const download = readdirSync(dirs.downloads).find((f) => f.endsWith('.scanruler'))
ok('page’s Save button produces a download', `${basename(download)}, ${statSync(join(dirs.downloads, download)).size} bytes`)

// ---- closing with unsaved work doesn't hang; scanruler_open brings the app back
await client.close()
browser.disconnect()
execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], { stdio: 'ignore' })
await sleep(2000)
;({ client, call } = await startConnector())
const down = (await call('scanruler_status')).json
check(down.connected === false && down.server.role === 'holder', 'with the app closed, Claude’s copy holds the port and waits', `connected=${down.connected}, role=${down.server.role}`)
const reopened = await call('scanruler_open', {})
console.log(`      scanruler_open said: ${reopened.text.slice(0, 160)}`)
const back = await until(async () => {
  const s = (await call('scanruler_status')).json
  return s.connected ? s : null
}, 60_000, 'scanruler_open to bring up the app')
check(back.page.origin === `http://127.0.0.1:${APP_PORT}`, 'scanruler_open starts the app, and it pairs by itself', back.page.origin)
await client.close()

check(hash(project) === originalHash, 'the test project file was not changed')
console.log(consoleErrors.length ? `Page console errors (${consoleErrors.length}):\n  ${consoleErrors.slice(0, 12).join('\n  ')}` : 'No page console errors.')
execFileSync('taskkill', ['/IM', basename(exe), '/T', '/F'], { stdio: 'ignore' })
console.log(failed ? `${failed} check(s) failed.` : 'All checks passed.')
process.exit(failed ? 1 : 0)
