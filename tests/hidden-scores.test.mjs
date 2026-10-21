// Standalone Node integration test outside the TypeScript project.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createRequire } from "node:module"
import { createServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import test from "node:test"
const require = createRequire(
  new URL("../packages/web/package.json", import.meta.url),
)
const { io } = require("socket.io-client")
function event(socket, name, predicate = () => true) {
  return new Promise((done, fail) => {
    const timer = setTimeout(() => {
      socket.off(name, listener)
      fail(new Error(`Timed out: ${name}`))
    }, 20000)
    function listener(data) {
      if (predicate(data)) {
        clearTimeout(timer)
        socket.off(name, listener)
        done(data)
      }
    }
    socket.on(name, listener)
  })
}
const status = (socket, name) =>
  event(socket, "game:status", (data) => data.name === name)

test(
  "hidden scores stay private until the manager reveals the final medals",
  { timeout: 70000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "razzia-hidden-scores-"))
    const probe = createServer()
    await new Promise((done) => {
      probe.listen(0, "127.0.0.1", done)
    })
    const { port } = probe.address()
    await new Promise((done) => {
      probe.close(done)
    })
    await mkdir(join(dir, "quizz"))
    await writeFile(
      join(dir, "game.json"),
      JSON.stringify({ managerPassword: "test-password" }),
    )
    const quiz = {
      id: "hidden",
      subject: "Secret scores",
      hideScoresUntilEnd: true,
      questions: [1, 2].map((number) => ({
        type: "single",
        question: `Round ${number}`,
        answers: ["Correct", "Wrong"],
        solutions: [0],
        cooldown: 3,
        time: 10,
      })),
    }
    await writeFile(join(dir, "quizz/hidden.json"), JSON.stringify(quiz))
    const server = spawn(
      process.execPath,
      [resolve("packages/socket/dist/index.cjs")],
      {
        env: { ...process.env, CONFIG_PATH: dir, SOCKET_PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    let logs = ""
    server.stdout.on("data", (data) => {
      logs += String(data)
    })
    server.stderr.on("data", (data) => {
      logs += String(data)
    })
    const sockets = []
    const connect = async (clientId) => {
      const socket = io(`http://127.0.0.1:${port}`, {
        path: "/ws",
        auth: { clientId },
        transports: ["websocket"],
        autoConnect: false,
        reconnection: false,
      })
      sockets.push(socket)
      const connected = event(socket, "connect")
      socket.connect()
      await connected

      return socket
    }

    try {
      for (
        let i = 0;
        i < 100 && !logs.includes("Socket server running");
        i += 1
      ) {
        // Startup polling must remain sequential.
        // oxlint-disable-next-line no-await-in-loop
        await delay(20)
      }
      const manager = await connect("hidden-manager")
      const authenticated = event(manager, "manager:config")
      manager.emit("manager:auth", "test-password")
      await authenticated
      // Import/export must retain the checkbox, rather than silently dropping it.
      const saved = event(manager, "quizz:updateSuccess")
      manager.emit("quizz:update", quiz)
      await saved
      const loaded = event(manager, "quizz:data")
      manager.emit("quizz:get", "hidden")
      assert.equal((await loaded).hideScoresUntilEnd, true)
      const created = event(manager, "manager:gameCreated")
      manager.emit("game:create", "hidden")
      const { gameId, inviteCode } = await created
      const display = await connect("hidden-display")
      const authorized = event(display, "projection:authorized")
      display.emit("projection:open", { password: "test-password", inviteCode })
      const { token } = await authorized
      let snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      await snapshot
      let player = await connect("hidden-player")
      const joined = event(player, "game:successJoin")
      player.emit("player:login", { gameId, data: { username: "Alice" } })
      await joined
      const publicMessages = []
      const playerMessages = []
      display.onAny((name, data) => publicMessages.push({ name, data }))
      player.onAny((name, data) => playerMessages.push({ name, data }))
      let answers = status(display, "SELECT_ANSWER")
      manager.emit("manager:startGame", { gameId })
      await answers
      // Cannot reveal early.
      manager.emit("manager:revealFinal", { gameId })
      const reveal = status(display, "SHOW_RESPONSES")
      const pause = status(display, "ROUND_PAUSE")
      const playerPause = status(player, "ROUND_PAUSE")
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [0] },
      })
      assert.equal((await reveal).data.hideScores, true)
      assert.equal((await pause).data.hideScores, true)
      await playerPause
      assert.equal(
        publicMessages.some((message) =>
          ["SHOW_LEADERBOARD", "FINISHED"].includes(message.data?.name),
        ),
        false,
      )
      assert.equal(
        playerMessages.some((message) => message.data?.name === "SHOW_RESULT"),
        false,
      )
      // Reconnect after scoring: neither total nor rank may be exposed.
      player.disconnect()
      await delay(100)
      player = await connect("hidden-player")
      player.onAny((name, data) => playerMessages.push({ name, data }))
      const restored = event(player, "player:successReconnect")
      player.emit("player:reconnect", { gameId })
      const reconnect = await restored
      assert.equal(reconnect.player.points, 0)
      assert.equal(reconnect.status.name, "ROUND_PAUSE")
      assert.equal(reconnect.status.data.hideScores, true)
      snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "ROUND_PAUSE")
      answers = status(display, "SELECT_ANSWER")
      manager.emit("manager:nextQuestion", { gameId })
      await answers
      const waiting = status(display, "AWAITING_FINAL")
      const playerWaiting = status(player, "AWAITING_FINAL")
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [0] },
      })
      await waiting
      await playerWaiting
      assert.equal(
        publicMessages.some((message) =>
          ["SHOW_LEADERBOARD", "FINISHED"].includes(message.data?.name),
        ),
        false,
      )
      assert.equal(
        playerMessages.some((message) =>
          ["SHOW_RESULT", "FINISHED"].includes(message.data?.name),
        ),
        false,
      )
      const serialized = JSON.stringify(publicMessages)
      assert.equal(serialized.includes('"points":'), false)
      assert.equal(serialized.includes('"rank":'), false)
      // A projection or player cannot trigger the final reveal.
      display.emit("manager:revealFinal", { gameId })
      player.emit("manager:revealFinal", { gameId })
      await delay(100)
      snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "AWAITING_FINAL")
      const final = status(display, "FINISHED")
      const playerFinal = status(player, "FINISHED")
      manager.emit("manager:revealFinal", { gameId })
      const podium = await final
      const personal = await playerFinal
      assert.equal(podium.data.top[0].username, "Alice")
      assert.ok(podium.data.top[0].points > 0)
      assert.equal(podium.data.hideScores, false)
      assert.equal(personal.data.rank, 1)
      assert.equal(personal.data.points, podium.data.top[0].points)
      assert.equal("clientId" in personal.data.top[0], false)
      manager.emit("manager:revealFinal", { gameId })
      await delay(100)
      assert.equal((await readdir(join(dir, "results"))).length, 1)
      const report = JSON.parse(
        await readFile(
          join(dir, "results", (await readdir(join(dir, "results")))[0]),
          "utf8",
        ),
      )
      assert.equal(report.players[0].points, personal.data.points)
    } catch (error) {
      error.message = `${String(error.message)}\nServer logs:\n${logs}`
      throw error
    } finally {
      sockets.forEach((socket) => {
        socket.disconnect()
      })
      const exited = new Promise((done) => {
        server.once("exit", done)
      })
      server.kill("SIGTERM")
      await exited
      await rm(dir, { recursive: true, force: true })
    }
  },
)
