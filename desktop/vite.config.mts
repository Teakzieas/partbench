// SPDX-License-Identifier: AGPL-3.0-only
// The page, built for the desktop app: upstream's Vite config plus one plugin,
// so ScanRuler's own source files stay as they are and merging new versions
// from upstream stays easy. See lib/rebrand.mjs for what it changes and why.
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, type Plugin } from 'vite'
import upstream from '../vite.config'
import { rebrand, rebrandHtml, shouldRebrand } from './lib/rebrand.mjs'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const outDir = here('../dist-desktop')

function desktopBrand(): Plugin {
  return {
    name: 'desktop-brand',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!shouldRebrand(file)) return null
      const next = rebrand(code)
      return next === code ? null : { code: next, map: null }
    },
    transformIndexHtml: rebrandHtml,
    closeBundle() {
      // The same paths the page already asks for, with this app's own mark in
      // place of the ScanRuler logo.
      copyFileSync(here('./assets/mark.svg'), `${outDir}/scanruler-mark.svg`)
      copyFileSync(here('./assets/mark.svg'), `${outDir}/favicon.svg`)
      copyFileSync(here('./assets/favicon.ico'), `${outDir}/favicon.ico`)
    },
  }
}

export default mergeConfig(upstream, defineConfig({
  root: here('..'),
  plugins: [desktopBrand()],
  build: { outDir, emptyOutDir: true },
}))
