// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rebrand, rebrandHtml, shouldRebrand } from '../lib/rebrand.mjs'

test('only interface files are renamed, not the core or the author’s own cards', () => {
  assert.equal(shouldRebrand('C:/r/src/ui/TopBar.tsx'), true)
  assert.equal(shouldRebrand('/r/plugins/reverse/ui/Panel.tsx'), true)
  assert.equal(shouldRebrand('/r/src/core/project/manifest.ts'), false)
  assert.equal(shouldRebrand('/r/src/ui/SupportCard.tsx'), false)
  assert.equal(shouldRebrand('/r/src/ui/Imprint.tsx'), false)
})

test('the top bar names this app and credits the author', () => {
  const out = rebrand(readFileSync(new URL('../../src/ui/TopBar.tsx', import.meta.url), 'utf8'))
  assert.match(out, /<b>PartBench<\/b>/)
  assert.match(out, /Based on ScanRuler by CNC Kitchen · 3D scan analysis/)
  assert.match(out, /github\.com\/Teakzieas\/partbench/)
  assert.doesNotMatch(out.replace('Based on ScanRuler by CNC Kitchen', ''), /\bScanRuler\b/)
})

test('a type name that contains the word is left alone', () => {
  assert.equal(rebrand('const a: ScanRulerPlugin = b // ScanRuler'), 'const a: ScanRulerPlugin = b // PartBench')
})

test('the page title changes and the description keeps the credit', () => {
  const out = rebrandHtml('<title>ScanRuler by CNC Kitchen</title><meta content="ScanRuler by CNC Kitchen — analyze">')
  assert.equal(out, '<title>PartBench</title><meta content="PartBench, based on ScanRuler by CNC Kitchen — analyze">')
})
