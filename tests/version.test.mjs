import assert from "node:assert/strict"
import test from "node:test"
import {
  createVersionChecker,
  fetchLatestCommit,
  installedCommit,
} from "../packages/socket/src/services/version.ts"

const current = "a".repeat(40)
const next = "b".repeat(40)

test("same commit is current; a different commit announces an update", async () => {
  for (const [latest, expected] of [
    [current, "current"],
    [next, "update"],
  ]) {
    const check = createVersionChecker({
      currentCommit: current,
      fetchLatest: async () => latest,
    })
    const result = await check()
    assert.equal(result.status, expected)
    assert.equal(result.currentCommit, current)
    assert.equal(result.latestCommit, latest)
  }
})

test("success is shared across tabs, then refreshed after five minutes", async () => {
  let time = 0
  let calls = 0
  let remote = current
  const check = createVersionChecker({
    currentCommit: current,
    fetchLatest: async () => {
      calls++
      return remote
    },
    now: () => time,
  })
  assert.equal((await check()).status, "current")
  remote = next
  time = 299999
  assert.equal((await check()).status, "current")
  assert.equal(calls, 1)
  time = 300000
  assert.equal((await check()).status, "update")
  assert.equal(calls, 2)
})

test("concurrent requests share one GitHub fetch", async () => {
  let release
  let calls = 0
  const check = createVersionChecker({
    currentCommit: current,
    fetchLatest: () => {
      calls++
      return new Promise((resolve) => {
        release = resolve
      })
    },
  })
  const first = check()
  const second = check()
  assert.equal(calls, 1)
  release(next)
  assert.deepEqual(await first, await second)
})

test("failure clears stale success and retries after one minute", async () => {
  let time = 0
  let fail = false
  let calls = 0
  const check = createVersionChecker({
    currentCommit: current,
    now: () => time,
    fetchLatest: async () => {
      calls++
      if (fail) throw new Error("offline")
      return current
    },
  })
  assert.equal((await check()).status, "current")
  fail = true
  time = 300000
  const failed = await check()
  assert.equal(failed.status, "unavailable")
  assert.equal(failed.latestCommit, null)
  assert.equal(failed.currentCommit, current)
  time += 59999
  await check()
  assert.equal(calls, 2)
  time++
  fail = false
  assert.equal((await check()).status, "current")
  assert.equal(calls, 3)
})

test("unknown local version never claims to be current", async () => {
  for (const commit of [null, "invalid", "abc1234"]) {
    const check = createVersionChecker({
      currentCommit: commit,
      fetchLatest: async () => {
        throw new Error("must not fetch")
      },
    })
    assert.equal((await check()).status, "unavailable")
  }
})

test("invalid remote commits never announce a version", async () => {
  const check = createVersionChecker({
    currentCommit: current,
    fetchLatest: async () => "invalid",
  })
  assert.equal((await check()).status, "unavailable")
})

test("GitHub request targets the AS Event branch with timeout", async () => {
  const commit = await fetchLatestCommit(async (url, options) => {
    assert.equal(
      url,
      "https://api.github.com/repos/toneios/Razzia/commits/as-event%2Fthree-interfaces",
    )
    assert.ok(options.signal instanceof AbortSignal)
    assert.equal(options.redirect, "error")
    return new Response(JSON.stringify({ sha: next }), { status: 200 })
  })
  assert.equal(commit, next)
})

test("GitHub rate limits, malformed JSON, and invalid payloads fail safely", async () => {
  for (const response of [
    new Response("rate limited", { status: 403 }),
    new Response("not json", { status: 200 }),
    new Response("null", { status: 200 }),
    new Response(JSON.stringify({ sha: "invalid" }), { status: 200 }),
  ]) {
    await assert.rejects(fetchLatestCommit(async () => response))
  }
})

test("a build stamp identifies compiled code even after source changes", () => {
  const previous = process.env.RAZZIA_BUILD_COMMIT
  try {
    process.env.RAZZIA_BUILD_COMMIT = current
    assert.equal(installedCommit(), current)
    process.env.RAZZIA_BUILD_COMMIT = next
    assert.equal(installedCommit(), next)
  } finally {
    if (previous === undefined) delete process.env.RAZZIA_BUILD_COMMIT
    else process.env.RAZZIA_BUILD_COMMIT = previous
  }
})
