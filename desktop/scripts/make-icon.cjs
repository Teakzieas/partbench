// SPDX-License-Identifier: AGPL-3.0-only
// Draws assets/icon.png and assets/favicon.ico from assets/mark.svg, with
// Chromium as the renderer. Run by hand when the mark changes: npm run icon.
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const assets = join(__dirname, '..', 'assets')

/** A PNG inside the .ico container, which Windows has read since Vista. */
function ico(png, size) {
  const head = Buffer.alloc(22)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(1, 4)
  head[6] = size
  head[7] = size
  head.writeUInt16LE(1, 10)
  head.writeUInt16LE(32, 12)
  head.writeUInt32LE(png.length, 14)
  head.writeUInt32LE(22, 18)
  return Buffer.concat([head, png])
}

app.whenReady().then(async () => {
  const svg = readFileSync(join(assets, 'mark.svg'), 'utf8')
  const size = 512
  const win = new BrowserWindow({ width: size, height: size, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const html = `<!doctype html><style>*{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((r) => setTimeout(r, 500))
  const image = await win.webContents.capturePage()
  writeFileSync(join(assets, 'icon.png'), image.resize({ width: size, height: size }).toPNG())
  writeFileSync(join(assets, 'favicon.ico'), ico(image.resize({ width: 48, height: 48, quality: 'best' }).toPNG(), 48))
  app.quit()
})
