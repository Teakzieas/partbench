// SPDX-License-Identifier: AGPL-3.0-only
const assert = require('node:assert/strict')
const { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { test } = require('node:test')
const { add, entryFor, status } = require('../lib/connector.cjs')

const entry = entryFor({ exe: 'C:/a/PartBench.exe', serverJs: 'C:/a/mcp.js', appUrl: 'http://127.0.0.1:7318/', outDir: 'C:/out' })
const place = () => join(mkdtempSync(join(tmpdir(), 'partbench-')), 'claude_desktop_config.json')

test('a missing file is created with only the connector', () => {
  const file = place()
  assert.equal(status(file, entry).state, 'absent')
  assert.equal(add(file, entry), null)
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { mcpServers: { partbench: entry } })
  assert.equal(status(file, entry).state, 'current')
})

test('everything else in the file is kept and a backup is made', () => {
  const file = place()
  const before = { preferences: { a: 1 }, mcpServers: { other: { command: 'x' }, scanruler: { command: 'npx' } }, more: [1, 2] }
  const text = JSON.stringify(before)
  writeFileSync(file, text)
  assert.equal(status(file, entry).stock, true)
  const backup = add(file, entry, { now: () => 7 })
  assert.equal(readFileSync(backup, 'utf8'), text)
  const after = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(after.preferences, before.preferences)
  assert.deepEqual(after.more, before.more)
  assert.deepEqual(after.mcpServers, { other: { command: 'x' }, partbench: entry })
})

test('a file that is not JSON is left alone', () => {
  const file = place()
  writeFileSync(file, '{ not json')
  assert.equal(status(file, entry).state, 'unreadable')
  assert.throws(() => add(file, entry))
  assert.equal(readFileSync(file, 'utf8'), '{ not json')
  assert.equal(readdirSync(join(file, '..')).length, 1)
})

test('an entry for another copy of the app reads as outdated', () => {
  const file = place()
  writeFileSync(file, JSON.stringify({ mcpServers: { partbench: { ...entry, command: 'C:/old.exe' } } }))
  assert.equal(status(file, entry).state, 'outdated')
  assert.ok(existsSync(file))
})
