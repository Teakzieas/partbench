// SPDX-License-Identifier: AGPL-3.0-only
// The start card: the one prompt to copy, whether Claude Desktop has the
// connector, and the credit to ScanRuler's author. It is added over the page
// from here rather than in the page's source, so ScanRuler's own files stay
// unchanged, and in a shadow root so neither one's styles reach the other.
// It sits at the side with no backdrop, so the page's own first-run warning
// about agent access stays visible and clickable beside it.

const { ipcRenderer } = require('electron')

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: Barlow, "Segoe UI", system-ui, sans-serif; }
.card { position: fixed; top: 64px; right: 16px; width: 372px; max-height: calc(100vh - 88px); overflow: auto;
  background: #fff; color: #1b2422; border: 1px solid #c9d3d0; border-radius: 10px; padding: 16px;
  box-shadow: 0 10px 34px rgba(10, 30, 26, .28); z-index: 2147483000; font-size: 14px; line-height: 1.4; }
h2 { margin: 0 0 2px; font-size: 18px; font-weight: 600; }
.sub { margin: 0 0 12px; color: #52605c; font-size: 13px; }
.x { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; font-size: 18px; color: #52605c; }
.x:hover { background: #eef2f1; }
.row { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; border-top: 1px solid #e6ebe9; }
.dot { flex: none; width: 10px; height: 10px; margin-top: 5px; border-radius: 50%; background: #b9c4c1; }
.dot.ok { background: #14756b; } .dot.wait { background: #e0a22e; } .dot.bad { background: #c0392b; }
.row div { flex: 1; }
.note { color: #52605c; font-size: 12.5px; display: block; margin-top: 2px; }
.step { margin: 12px 0 6px; font-weight: 600; }
textarea { width: 100%; height: 118px; resize: none; border: 1px solid #c9d3d0; border-radius: 6px; padding: 8px; font-size: 13px; color: #1b2422; background: #f6f8f7; }
button.main { width: 100%; margin-top: 8px; padding: 9px; border: 0; border-radius: 6px; background: #14756b; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
button.main:hover { background: #0f5f57; }
button.small { margin-top: 6px; padding: 5px 10px; border: 1px solid #14756b; border-radius: 6px; background: #fff; color: #14756b; font-size: 13px; font-weight: 600; cursor: pointer; }
button.small:hover { background: #e9f3f1; }
.credit { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid #e6ebe9; color: #52605c; font-size: 12px; }
a { color: #14756b; cursor: pointer; }
.pill { position: fixed; right: 16px; bottom: 40px; padding: 8px 14px; border: 0; border-radius: 18px; background: #14756b; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(10, 30, 26, .3); z-index: 2147483000; }
[hidden] { display: none !important; }
@media (prefers-color-scheme: dark) {
  .card { background: #1d2523; color: #e8eeec; border-color: #3a4643; }
  .sub, .note, .credit, .x { color: #a9b6b2; }
  .row, .credit { border-color: #323d3a; }
  .x:hover { background: #2a3431; }
  textarea { background: #161c1a; color: #e8eeec; border-color: #3a4643; }
  button.small { background: transparent; color: #6fd0c3; border-color: #6fd0c3; }
  button.small:hover { background: #24302d; }
  a { color: #6fd0c3; }
}`

const HTML = `
<style>${STYLE}</style>
<button class="pill" id="pill" hidden>Start with Claude</button>
<section class="card" id="card" aria-label="Start with Claude" data-test="partbench-start">
  <button class="x" id="close" aria-label="Close">×</button>
  <h2>Start with Claude</h2>
  <p class="sub">Paste this prompt into a Claude Desktop chat to start working.</p>
  <div class="row"><span class="dot" id="linkDot"></span><div><span id="linkText">Starting the connector…</span></div></div>
  <div class="row"><span class="dot" id="claudeDot"></span><div><span id="claudeText">Checking Claude Desktop…</span>
    <span class="note" id="claudeNote" hidden></span>
    <button class="small" id="add" hidden>Add to Claude Desktop</button></div></div>
  <div class="row" id="updateRow" hidden><span class="dot ok"></span><div><span id="updateText"></span>
    <button class="small" id="install" hidden>Restart and update</button></div></div>
  <p class="step">Your prompt</p>
  <textarea id="prompt" readonly data-test="partbench-prompt"></textarea>
  <button class="main" id="copy" data-test="partbench-copy">Copy prompt</button>
  <p class="credit">PartBench is an unofficial desktop build of
    <a id="upstream">ScanRuler by Stefan Hermann (CNC Kitchen)</a>, not made or endorsed by them.
    Free software under the AGPL-3.0. <a id="source">Source code</a>.</p>
</section>`

function mount() {
  const host = document.createElement('div')
  host.id = 'partbench-start'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = HTML
  document.documentElement.append(host)
  const $ = (id) => root.getElementById(id)
  let urls = {}

  const show = (open) => {
    $('card').hidden = !open
    $('pill').hidden = open
  }
  $('close').onclick = () => show(false)
  $('pill').onclick = () => show(true)
  $('upstream').onclick = () => ipcRenderer.invoke('partbench:open', urls.upstreamUrl)
  $('source').onclick = () => ipcRenderer.invoke('partbench:open', urls.forkUrl)
  $('install').onclick = () => ipcRenderer.invoke('partbench:install-update')
  $('copy').onclick = async () => {
    await ipcRenderer.invoke('partbench:copy', $('prompt').value)
    $('copy').textContent = 'Copied. Now paste it into Claude'
    setTimeout(() => {
      $('copy').textContent = 'Copy prompt'
    }, 2500)
  }
  $('add').onclick = async () => {
    if (await ipcRenderer.invoke('partbench:add-connector')) {
      restartNeeded = true
      refresh()
    }
  }

  let restartNeeded = false
  const setDot = (id, kind) => {
    $(id).className = `dot ${kind}`
  }

  const update = (u) => {
    $('updateRow').hidden = u.state === 'idle'
    $('install').hidden = u.state !== 'ready'
    if (u.state === 'downloading') $('updateText').textContent = `Downloading version ${u.version}…`
    if (u.state === 'ready') $('updateText').textContent = `Version ${u.version} is ready. It installs when you close the app.`
  }

  async function refresh() {
    const s = await ipcRenderer.invoke('partbench:status')
    urls = s
    if (!$('prompt').value) $('prompt').value = s.prompt
    if (s.link.page) {
      setDot('linkDot', 'ok')
      $('linkText').textContent = 'App and connector are paired'
    } else if (s.link.otherPage) {
      setDot('linkDot', 'bad')
      $('linkText').textContent = `A browser tab has the connection (${s.link.otherPage}). Close that tab and this window connects by itself.`
    } else if (s.link.server) {
      setDot('linkDot', 'wait')
      $('linkText').textContent = 'Connector running, waiting for the app to pair. If a warning about agent access is showing, accept it to connect.'
    } else {
      setDot('linkDot', 'wait')
      $('linkText').textContent = 'Starting the connector…'
    }
    const { state, stock } = s.claude
    $('add').hidden = state === 'current' || state === 'unreadable'
    $('claudeNote').hidden = true
    if (state === 'current') {
      setDot('claudeDot', 'ok')
      $('claudeText').textContent = 'Claude Desktop has the connector'
      if (restartNeeded) {
        $('claudeNote').textContent = 'Now quit Claude Desktop fully (File → Exit) and open it again.'
        $('claudeNote').hidden = false
      }
    } else if (state === 'unreadable') {
      setDot('claudeDot', 'bad')
      $('claudeText').textContent = 'Claude Desktop’s config file could not be read'
      $('claudeNote').textContent = 'Fix it under Settings → Developer → Edit Config in Claude Desktop.'
      $('claudeNote').hidden = false
    } else if (state === 'outdated') {
      setDot('claudeDot', 'wait')
      $('claudeText').textContent = 'The connector points at another copy of this app'
      $('add').textContent = 'Update in Claude Desktop'
    } else {
      setDot('claudeDot', stock ? 'wait' : 'bad')
      $('claudeText').textContent = stock ? 'Claude Desktop has the older npm connector' : 'Claude Desktop does not have the connector yet'
      if (stock) {
        $('claudeNote').textContent = 'That one works too, but it opens a browser tab rather than this app.'
        $('claudeNote').hidden = false
      }
    }
    update(s.update)
  }

  ipcRenderer.on('partbench:update', (_event, state) => update(state))
  refresh()
  setInterval(refresh, 3000)
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', mount)
else mount()
