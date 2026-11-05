// SPDX-License-Identifier: AGPL-3.0-only
// electron-builder never copies node_modules through extraResources, so the
// connector's dependencies are installed into the packed app here, production
// ones only, at the versions its lockfile pins.
const { execSync } = require('node:child_process')
const { copyFileSync, existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = async function afterPack({ appOutDir, packager }) {
  const mcp = join(appOutDir, 'resources', 'mcp')
  copyFileSync(join(packager.projectDir, '..', 'mcp', 'package-lock.json'), join(mcp, 'package-lock.json'))
  execSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', { cwd: mcp, stdio: 'inherit' })
  if (!existsSync(join(mcp, 'node_modules', '@modelcontextprotocol', 'sdk'))) {
    throw new Error('The connector’s dependencies did not install.')
  }
}
