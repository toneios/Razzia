// Node's standalone JS test runner uses a dynamically resolved Socket.IO client.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/restrict-plus-operands */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve as resolvePath } from "node:path"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"

const require = createRequire(
  new URL("../packages/web/package.json", import.meta.url),
)
const { io } = require("socket.io-client")
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(name, listener)
      reject(new Error(`Timed out: ${name}`))
    }, 20000)
    function listener(data) {
      if (predicate(data)) {
        clearTimeout(timeout)
        socket.off(name, listener)
        resolve(data)
      }
    }
    socket.on(name, listener)
  })
}
const status = (socket, name) =>
  event(socket, "game:status", (data) => data.name === name)

test(
  "independent projection, manual reveal, reconnect and read-only controls",
  { timeout: 60000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "razzia-projection-test-"))
    const portServer = createServer()
    await new Promise((resolve) => {
      portServer.listen(0, "127.0.0.1", resolve)
    })
    const { port } = portServer.address()
    await new Promise((resolve) => {
      portServer.close(resolve)
    })
    await mkdir(join(dir, "quizz"))
    await writeFile(
      join(dir, "game.json"),
      JSON.stringify({ managerPassword: "test-only-password" }),
    )
    await writeFile(
      join(dir, "quizz/test.json"),
      JSON.stringify({
        id: "test",
        subject: "Projection integration",
        questions: [
          {
            type: "single",
            question: "First question",
            answers: ["Yes", "No"],
            solutions: [0],
            cooldown: 3,
            time: 10,
          },
          {
            type: "multi",
            question: "Second question",
            answers: ["A", "B", "C"],
            solutions: [0, 2],
            cooldown: 3,
            time: -1,
            options: { scoringMode: "strict" },
          },
        ],
      }),
    )
    const server = spawn(
      process.execPath,
      [resolvePath("packages/socket/dist/index.cjs")],
      {
        env: { ...process.env, CONFIG_PATH: dir, SOCKET_PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const sockets = []
    let logs = ""
    server.stdout.on("data", (data) => {
      logs += data
    })
    server.stderr.on("data", (data) => {
      logs += data
    })
    const connect = async (clientId) => {
      const socket = io(`http://127.0.0.1:${port}`, {
        path: "/ws",
        auth: { clientId },
        transports: ["websocket"],
        autoConnect: false,
        reconnection: false,
      })
      sockets.push(socket)
      const ready = event(socket, "connect")
      socket.connect()
      await ready

      return socket
    }

    try {
      for (
        let i = 0;
        !logs.includes("Socket server running") && i < 100;
        i += 1
      ) {
        // Readiness polling must remain sequential.
        // oxlint-disable-next-line no-await-in-loop
        await delay(20)
      }
      const manager = await connect("secret-manager-id")
      const config = event(manager, "manager:config")
      manager.emit("manager:auth", "test-only-password")
      await config
      const created = event(manager, "manager:gameCreated")
      manager.emit("game:create", "test")
      const { gameId, inviteCode } = await created
      // Neither the public PIN nor a direct game URL grants projection access.
      const intruder = await connect("intruder")
      const leaked = []
      intruder.onAny((name) => {
        if (
          ["projection:snapshot", "projection:players", "game:status"].includes(
            name,
          )
        ) {
          leaked.push(name)
        }
      })
      let denied = event(intruder, "projection:unauthorized")
      intruder.emit("projection:join", { gameId })
      await denied
      denied = event(intruder, "projection:unauthorized")
      intruder.emit("projection:join", { gameId, token: "f".repeat(64) })
      await denied
      denied = event(intruder, "projection:unauthorized")
      intruder.emit("projection:join", null)
      await denied
      const wrongPassword = event(intruder, "projection:authError")
      intruder.emit("projection:open", { password: "incorrect", inviteCode })
      assert.equal(await wrongPassword, "errors:manager.invalidPassword")
      const noSuchPin = event(intruder, "projection:authError")
      intruder.emit("projection:open", {
        password: "test-only-password",
        inviteCode: "------",
      })
      assert.equal(await noSuchPin, "errors:game.notFound")

      const display = await connect("display-id")
      const access = event(display, "projection:authorized")
      display.emit("projection:open", {
        password: "test-only-password",
        inviteCode,
      })
      const permission = await access
      assert.equal(permission.gameId, gameId)
      const { token } = permission
      assert.equal(token.length, 64)
      const publicMessages = []
      display.onAny((name, data) => publicMessages.push({ name, data }))
      let snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "SHOW_ROOM")
      // Merely opening a public display cannot start a game or gain manager configuration.
      const unauthorized = event(display, "manager:unauthorized")
      display.emit("manager:getConfig")
      await unauthorized
      display.emit("manager:startGame", { gameId })
      const player = await connect("secret-player-id")
      const names = event(display, "projection:players")
      const joined = event(player, "game:successJoin")
      player.emit("player:login", { gameId, data: { username: "Alice" } })
      await joined
      assert.deepEqual(await names, ["Alice"])
      let answers = status(display, "SELECT_ANSWER")
      manager.emit("manager:startGame", { gameId })
      const question = await answers
      assert.equal(question.data.question, "First question")
      assert.equal("solutions" in question.data, false)
      assert.equal(question.data.totalPlayer, 1)
      // Refresh/second display restores current phase and a live remaining timer.
      await delay(1100)
      const secondDisplay = await connect("display-two")
      snapshot = event(secondDisplay, "projection:snapshot")
      secondDisplay.emit("projection:join", { gameId, token })
      const active = await snapshot
      assert.equal(active.status.name, "SELECT_ANSWER")
      assert.ok(active.remaining < 10 && active.remaining > 0)
      secondDisplay.disconnect()
      const locked = status(display, "AWAITING_REVEAL")
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [0] },
      })
      await locked
      display.emit("manager:reveal", { gameId })
      await delay(100)
      assert.equal(publicMessages.at(-1).data.name, "AWAITING_REVEAL")
      // Late answers cannot change the recorded answer after the lock.
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [1] },
      })
      const result = status(player, "SHOW_RESULT")
      const reveal = status(display, "SHOW_RESPONSES")
      manager.emit("manager:reveal", { gameId })
      assert.equal((await result).data.correct, true)
      assert.deepEqual((await reveal).data.solutions, [0])
      const board = status(display, "SHOW_LEADERBOARD")
      manager.emit("manager:showLeaderboard", { gameId })
      await board
      snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "SHOW_LEADERBOARD")
      answers = status(display, "SELECT_ANSWER")
      manager.emit("manager:nextQuestion", { gameId })
      const second = await answers
      assert.equal(second.data.questionType, "multi")
      assert.equal(second.data.time, -1)
      const lockTwo = status(display, "AWAITING_REVEAL")
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [0, 2] },
      })
      await lockTwo
      const revealTwo = status(display, "SHOW_RESPONSES")
      manager.emit("manager:reveal", { gameId })
      await revealTwo
      const finished = status(display, "FINISHED")
      manager.emit("manager:showLeaderboard", { gameId })
      assert.equal((await finished).data.top[0].username, "Alice")
      manager.emit("manager:showLeaderboard", { gameId })
      await delay(100)
      assert.equal((await readdir(join(dir, "results"))).length, 1)
      assert.equal(
        JSON.stringify(publicMessages).includes("secret-player-id"),
        false,
      )
      assert.equal(
        JSON.stringify(publicMessages).includes("secret-manager-id"),
        false,
      )
      snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "FINISHED")
      display.disconnect()
      assert.equal(manager.connected, true)
      // A missing/expired display URL clears the screen instead of becoming a player.
      const missing = await connect("missing-display")
      const reset = event(missing, "projection:unauthorized")
      missing.emit("projection:join", { gameId: "does-not-exist", token })
      await reset
      assert.deepEqual(leaked, [])
    } catch (error) {
      error.message += `\nServer logs:\n${logs}`
      throw error
    } finally {
      sockets.forEach((socket) => {
        socket.disconnect()
      })
      const exited = new Promise((resolve) => {
        server.once("exit", resolve)
      })
      server.kill("SIGTERM")
      await exited
      await rm(dir, { recursive: true, force: true })
    }
  },
)
