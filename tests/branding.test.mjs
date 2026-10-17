// Standalone Node test: this file is outside the TypeScript project.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"

test(
  "audio supports byte-range seeking and HEAD through the web server",
  { timeout: 20000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "razzia-audio-test-"))
    const probe = createServer()
    await new Promise((ready) => {
      probe.listen(0, "127.0.0.1", ready)
    })
    const { port } = probe.address()
    await new Promise((done) => {
      probe.close(done)
    })
    await mkdir(join(dir, "branding"))
    const bytes = Buffer.from("ID3-test-audio-range")
    await writeFile(join(dir, "branding/track-test.mp3"), bytes)
    const server = spawn(
      process.execPath,
      [
        resolve("packages/web/node_modules/vite/bin/vite.js"),
        "preview",
        "--port",
        String(port),
        "--host",
        "127.0.0.1",
        "--strictPort",
      ],
      {
        cwd: resolve("packages/web"),
        env: { ...process.env, CONFIG_PATH: dir },
        stdio: "ignore",
      },
    )

    try {
      let ready = false
      for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
        try {
          // Poll startup sequentially on an isolated local port.
          // oxlint-disable-next-line no-await-in-loop
          const response = await fetch(
            `http://127.0.0.1:${port}/branding/track-test.mp3`,
            { method: "HEAD" },
          )
          ready = response.ok
        } catch {
          // oxlint-disable-next-line no-await-in-loop
          await delay(50)
        }
      }
      assert.ok(ready, "web server started")
      const url = `http://127.0.0.1:${port}/branding/track-test.mp3`
      const chunk = await fetch(url, { headers: { Range: "bytes=4-8" } })
      assert.equal(chunk.status, 206)
      assert.equal(chunk.headers.get("Content-Type"), "audio/mpeg")
      assert.equal(
        chunk.headers.get("Content-Range"),
        `bytes 4-8/${bytes.length}`,
      )
      assert.equal(await chunk.text(), bytes.subarray(4, 9).toString())
      const suffix = await fetch(url, { headers: { Range: "bytes=-5" } })
      assert.equal(await suffix.text(), bytes.subarray(-5).toString())
      const invalid = await fetch(url, { headers: { Range: "bytes=900-" } })
      assert.equal(invalid.status, 416)
      const head = await fetch(url, { method: "HEAD" })
      assert.equal(head.headers.get("Content-Length"), String(bytes.length))
      assert.equal(await head.text(), "")
      assert.equal(
        (await fetch(`http://127.0.0.1:${port}/branding/..%2Fgame.json`))
          .status,
        404,
      )
    } finally {
      const exited = new Promise((done) => {
        server.once("exit", done)
      })
      server.kill("SIGTERM")
      await exited
      await rm(dir, { recursive: true, force: true })
    }
  },
)
