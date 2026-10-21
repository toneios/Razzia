// Standalone Node test with TypeScript source transformed by the project's esbuild.
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument */
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"
const require = createRequire(
  new URL("../packages/socket/package.json", import.meta.url),
)
const { build } = require("esbuild")
const bundle = await build({
  entryPoints: ["packages/web/src/features/game/utils/media-playback.ts"],
  bundle: true,
  write: false,
  format: "esm",
})
const { attachMediaPlayback } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
)

test("development effect detach/reattach resumes the same media element", async () => {
  const player = {
    playing: false,
    currentTime: 42,
    play() {
      this.playing = true

      return Promise.resolve()
    },
    pause() {
      this.playing = false
    },
  }
  const errors = []
  const firstCleanup = attachMediaPlayback(player, (error) =>
    errors.push(error),
  )
  await Promise.resolve()
  assert.equal(player.playing, true)
  firstCleanup()
  assert.equal(player.playing, false)
  const secondCleanup = attachMediaPlayback(player, (error) =>
    errors.push(error),
  )
  await Promise.resolve()
  assert.equal(player.playing, true)
  assert.equal(player.currentTime, 42, "resuming does not seek back")
  assert.deepEqual(errors, [])
  secondCleanup()
  assert.equal(player.playing, false, "reveal/unmount stops playback")
})

test("autoplay denial is reported, but stale and aborted play attempts are ignored", async () => {
  const errors = []
  const denied = Object.assign(new Error("gesture required"), {
    name: "NotAllowedError",
  })
  const player = {
    play: () => Promise.reject(denied),
    pause() {
      /* No active playback after a rejected play request. */
    },
  }
  const cleanup = attachMediaPlayback(player, (error) => errors.push(error))
  await Promise.resolve()
  assert.equal(errors[0], denied)
  cleanup()
  errors.length = 0
  const stale = attachMediaPlayback(player, (error) => errors.push(error))
  stale()
  await Promise.resolve()
  assert.deepEqual(errors, [])
  const aborted = {
    play: () =>
      Promise.reject(
        Object.assign(new Error("interrupted"), { name: "AbortError" }),
      ),
    pause() {
      /* No active playback after a rejected play request. */
    },
  }
  const stop = attachMediaPlayback(aborted, (error) => errors.push(error))
  await Promise.resolve()
  assert.deepEqual(errors, [])
  stop()
})
