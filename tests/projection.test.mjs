// Node's standalone JS test runner uses a dynamically resolved Socket.IO client.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/restrict-plus-operands */
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
  "appearance permissions, automatic reveal, ten-second hold and manual next question",
  { timeout: 90000 },
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
            time: 2,
            options: { scoringMode: "strict" },
          },
        ],
      }),
    )
    const server = spawn(
      process.execPath,
      [resolvePath("packages/socket/dist/index.cjs")],
      {
        env: {
          ...process.env,
          CONFIG_PATH: dir,
          SOCKET_PORT: String(port),
          MUSIC_PATH: join(dir, "music"),
          IMAGE_PATH: join(dir, "image"),
          VIDEO_PATH: join(dir, "video"),
        },
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
      await mkdir(join(dir, "branding"))
      await writeFile(
        join(dir, "branding/theme.json"),
        JSON.stringify({ logo: "/branding/my-logo.png" }),
      )
      const appearanceData = event(manager, "appearance:data")
      manager.emit("appearance:get")
      const appearance = await appearanceData
      appearance.colors.brand = "#663399"
      appearance.music.volume = 0.45
      let saved = event(manager, "appearance:saved")
      const changed = event(manager, "appearance:changed")
      manager.emit("appearance:save", appearance)
      await saved
      await changed
      let stored = JSON.parse(
        await readFile(join(dir, "branding/theme.json"), "utf8"),
      )
      assert.equal(stored.logo, "/branding/my-logo.png")
      assert.equal(stored.colors.brand, "#663399")
      assert.equal(stored.music.volume, 0.45)
      let rejected = event(manager, "appearance:error")
      manager.emit("appearance:save", {
        ...appearance,
        colors: { brand: "invalid" },
      })
      await rejected
      rejected = event(manager, "appearance:error")
      manager.emit("appearance:upload", {
        kind: "background",
        base64: Buffer.from("this is not an image").toString("base64"),
      })
      await rejected
      const png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
      const uploaded = event(manager, "appearance:uploaded")
      manager.emit("appearance:upload", { kind: "background", base64: png })
      const asset = await uploaded
      assert.match(asset.url, /^\/branding\/background-[a-f0-9-]+\.png$/u)
      assert.equal(
        (await readFile(join(dir, asset.url.slice(1)))).toString("base64"),
        png,
      )
      appearance.background = asset.url
      saved = event(manager, "appearance:saved")
      manager.emit("appearance:save", appearance)
      await saved
      stored = JSON.parse(
        await readFile(join(dir, "branding/theme.json"), "utf8"),
      )
      assert.equal(stored.background, asset.url)
      await mkdir(join(dir, "music"))
      const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(32)])
      await writeFile(join(dir, "music/Été 80.MP3"), mp3)
      await writeFile(join(dir, "music/notes.txt"), "ignored")
      let library = event(manager, "music:files")
      manager.emit("music:list")
      assert.deepEqual(await library, ["Été 80.MP3"])
      await writeFile(join(dir, "music/Second.mp3"), mp3)
      library = event(manager, "music:files")
      manager.emit("music:list")
      assert.equal((await library).length, 2)
      const imported = event(manager, "music:imported")
      manager.emit("music:import", "Été 80.MP3")
      const track = await imported
      assert.match(track.url, /^\/branding\/track-[a-f0-9-]+\.mp3$/u)
      assert.deepEqual(await readFile(join(dir, track.url.slice(1))), mp3)
      const invalidTrack = event(manager, "music:error")
      manager.emit("music:import", "../game.json")
      await invalidTrack
      // Saving/loading must retain a server-relative audio URL and clip offset.
      const quiz = JSON.parse(
        await readFile(join(dir, "quizz/test.json"), "utf8"),
      )
      quiz.questions[0].media = { type: "audio", url: track.url, startAt: 42 }
      const quizSaved = event(manager, "quizz:updateSuccess")
      manager.emit("quizz:update", { id: "test", ...quiz })
      await quizSaved
      await mkdir(join(dir, "image"))
      await mkdir(join(dir, "video"))
      const picture = Buffer.from(png, "base64")
      const movie = Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from("ftypisom"),
        Buffer.alloc(20),
      ])
      await writeFile(join(dir, "image/Photo test.png"), picture)
      await writeFile(join(dir, "video/Clip test.mp4"), movie)
      for (const [kind, name, bytes] of [
        ["image", "Photo test.png", picture],
        ["video", "Clip test.mp4", movie],
      ]) {
        const listed = event(manager, "mediaLibrary:files")
        manager.emit("mediaLibrary:list", kind)
        // Each media kind has an independent library.
        // oxlint-disable-next-line no-await-in-loop
        assert.deepEqual(await listed, { kind, files: [name] })
        const added = event(manager, "mediaLibrary:imported")
        manager.emit("mediaLibrary:import", { kind, name })
        // oxlint-disable-next-line no-await-in-loop
        const mediaAsset = await added
        assert.equal(mediaAsset.kind, kind)
        // oxlint-disable-next-line no-await-in-loop
        const importedBytes = await readFile(join(dir, mediaAsset.url.slice(1)))
        assert.deepEqual(importedBytes, bytes)
        // Persist and reload each imported media type through quiz validation.
        const mediaQuiz = event(manager, "quizz:updateSuccess")
        manager.emit("quizz:update", {
          ...quiz,
          id: "test",
          questions: [
            {
              ...quiz.questions[0],
              media: { type: kind, url: mediaAsset.url },
            },
          ],
        })
        // oxlint-disable-next-line no-await-in-loop
        await mediaQuiz
        const loadedQuiz = event(manager, "quizz:data")
        manager.emit("quizz:get", "test")
        // oxlint-disable-next-line no-await-in-loop
        assert.equal((await loadedQuiz).questions[0].media.url, mediaAsset.url)
      }
      const restoredQuiz = event(manager, "quizz:updateSuccess")
      manager.emit("quizz:update", { id: "test", ...quiz })
      await restoredQuiz
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
      for (const action of [
        "appearance:get",
        "appearance:save",
        "appearance:upload",
      ]) {
        const blocked = event(display, "manager:unauthorized")
        display.emit(action, appearance)
        // Each unauthorized mutation must be checked before proceeding.
        // oxlint-disable-next-line no-await-in-loop
        await blocked
      }
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
      assert.equal(question.data.media.startAt, 42)
      assert.match(question.data.media.url, /^\/branding\/track-/u)
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
      const reveal = status(display, "SHOW_RESPONSES")
      const playerReveal = status(player, "SHOW_RESPONSES")
      const result = status(player, "SHOW_RESULT")
      const board = status(display, "SHOW_LEADERBOARD")
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [0] },
      })
      const revealed = await reveal
      const revealTime = Date.now()
      assert.deepEqual(revealed.data.solutions, [0])
      assert.deepEqual((await playerReveal).data.solutions, [0])
      assert.ok(revealed.data.revealEndsAt - revealTime > 9500)
      // Late answers and early controls cannot alter or skip the ten-second reveal.
      player.emit("player:selectedAnswer", {
        gameId,
        data: { answerKeys: [1] },
      })
      display.emit("manager:reveal", { gameId })
      manager.emit("manager:showLeaderboard", { gameId })
      manager.emit("manager:nextQuestion", { gameId })
      await delay(200)
      assert.equal(
        publicMessages
          .filter((message) => message.name === "game:status")
          .at(-1).data.name,
        "SHOW_RESPONSES",
      )
      assert.equal((await result).data.correct, true)
      await board
      assert.ok(Date.now() - revealTime >= 9800)
      await delay(300)
      snapshot = event(display, "projection:snapshot")
      display.emit("projection:join", { gameId, token })
      assert.equal((await snapshot).status.name, "SHOW_LEADERBOARD")
      answers = status(display, "SELECT_ANSWER")
      manager.emit("manager:nextQuestion", { gameId })
      const second = await answers
      assert.equal(second.data.questionType, "multi")
      assert.equal(second.data.time, 2)
      // No answer on this round: the timer must trigger the same automatic sequence.
      const revealTwo = status(display, "SHOW_RESPONSES")
      const finished = status(display, "FINISHED")
      const timedReveal = await revealTwo
      assert.deepEqual(timedReveal.data.responses, {})
      const secondRevealTime = Date.now()
      assert.equal((await finished).data.top[0].username, "Alice")
      assert.ok(Date.now() - secondRevealTime >= 9800)
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
