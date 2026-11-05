// SPDX-License-Identifier: AGPL-3.0-only
// The app's own copy of the bundled scanruler-mcp server. It holds the port the
// page connects to, so the page shows as connected from the moment it opens.
// The copies Claude Desktop starts find the port taken and send their calls
// through this one, which is how upstream's relay.js already works; if Claude's
// copy got there first, this one relays through it instead.
//
// Stdout is the server's MCP channel: this asks it for its status the way any
// MCP client would, one JSON message per line, so the start card can show it.

const { spawn } = require('node:child_process')
const { EventEmitter } = require('node:events')

class Server extends EventEmitter {
  constructor({ exe, serverJs, args, env }) {
    super()
    this.options = { exe, serverJs, args, env }
    this.pending = new Map()
    this.nextId = 1
    this.buffer = ''
    this.child = null
  }

  async start() {
    const { exe, serverJs, args, env } = this.options
    this.child = spawn(exe, [serverJs, ...args], {
      env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child.stdout.setEncoding('utf8').on('data', (text) => this.#read(text))
    this.child.stderr.setEncoding('utf8').on('data', (text) => this.emit('log', text))
    this.child.on('exit', (code) => {
      this.child = null
      for (const { reject } of this.pending.values()) reject(new Error('The connector stopped.'))
      this.pending.clear()
      this.emit('exit', code)
    })
    this.child.on('error', (error) => this.emit('log', `Could not start the connector: ${error.message}\n`))
    await this.#ask('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'partbench-desktop', version: '1' },
    })
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
  }

  /** What scanruler_status answers, parsed. */
  async status() {
    const answer = await this.#ask('tools/call', { name: 'scanruler_status', arguments: {} })
    const text = answer?.content?.find((c) => c.type === 'text')?.text
    return JSON.parse(text)
  }

  stop() {
    if (!this.child) return
    try {
      this.child.stdin.end()
    } catch {}
    this.child.kill()
    this.child = null
  }

  #ask(method, params) {
    if (!this.child) return Promise.reject(new Error('The connector is not running.'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`The connector did not answer ${method}.`))
      }, 15_000)
      this.pending.set(id, {
        resolve: (value) => (clearTimeout(timer), resolve(value)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      })
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  #read(text) {
    this.buffer += text
    let end
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).trim()
      this.buffer = this.buffer.slice(end + 1)
      if (!line) continue
      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }
      const entry = this.pending.get(message.id)
      if (!entry) continue
      this.pending.delete(message.id)
      if (message.error) entry.reject(new Error(message.error.message))
      else entry.resolve(message.result)
    }
  }
}

module.exports = { Server }
