import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"

const require = createRequire(
  new URL("../packages/web/package.json", import.meta.url),
)
const { io } = require("socket.io-client")

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, listener)
      reject(new Error(`Timed out waiting for ${name}`))
    }, 5000)
    function listener(data) {
      clearTimeout(timer)
      resolve(data)
    }
    socket.once(name, listener)
  })
}

test(
  "version checks require manager authentication and use the server build",
  { timeout: 20000 },
  async () => {
    const config = await mkdtemp(join(tmpdir(), "razzia-version-"))
    await writeFile(
      join(config, "game.json"),
      JSON.stringify({ managerPassword: "version-test-only" }),
    )
    const listener = createServer()
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve))
    const { port } = listener.address()
    await new Promise((resolve) => listener.close(resolve))
    // No live GitHub dependency: intercept only the fixed version API request.
    const preload = `globalThis.fetch = async (url) => {
    if (url !== "https://api.github.com/repos/toneios/Razzia/commits/as-event%2Fthree-interfaces") throw new Error("Unexpected fetch");
    return new Response(JSON.stringify({ sha: "${"b".repeat(40)}" }), { status: 200 });
  }`
    const child = spawn(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(preload)}`,
        resolve("packages/socket/dist/index.cjs"),
      ],
      {
        cwd: resolve("packages/socket"),
        env: { ...process.env, CONFIG_PATH: config, SOCKET_PORT: String(port) },
        stdio: "ignore",
      },
    )
    const socket = io(`http://127.0.0.1:${port}`, {
      path: "/ws",
      auth: { clientId: "version-test-manager" },
      autoConnect: false,
      reconnectionDelay: 100,
    })
    try {
      const connected = event(socket, "connect")
      socket.connect()
      await connected
      let versions = 0
      socket.on("manager:version", () => versions++)
      const denied = event(socket, "manager:unauthorized")
      socket.emit("manager:getVersion")
      await denied
      assert.equal(versions, 0)

      const authenticated = event(socket, "manager:config")
      socket.emit("manager:auth", "version-test-only")
      await authenticated
      const version = event(socket, "manager:version")
      socket.emit("manager:getVersion")
      const result = await version
      assert.match(result.currentCommit, /^[a-f0-9]{40}$/)
      assert.equal(result.latestCommit, "b".repeat(40))
      assert.equal(result.status, "update")

      socket.emit("manager:logout")
      const deniedAfterLogout = event(socket, "manager:unauthorized")
      socket.emit("manager:getVersion")
      await deniedAfterLogout
      await delay(25)
      assert.equal(versions, 1)
    } finally {
      socket.disconnect()
      const exited = new Promise((resolve) => child.once("exit", resolve))
      child.kill("SIGTERM")
      await exited
      await rm(config, { recursive: true, force: true })
    }
  },
)
