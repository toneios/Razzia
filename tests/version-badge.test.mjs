import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import test from "node:test"

const require = createRequire(
  new URL("../packages/web/package.json", import.meta.url),
)
const buildRequire = createRequire(
  new URL("../packages/socket/package.json", import.meta.url),
)
const { build } = buildRequire("esbuild")
const { renderToStaticMarkup } = require("react-dom/server")

async function renderBadge(version, connected = true) {
  const result = await build({
    entryPoints: [
      resolve("packages/web/src/features/manager/components/VersionBadge.tsx"),
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react/jsx-runtime"],
    alias: {
      "@razzia/common/constants": resolve("packages/common/src/constants.ts"),
    },
    plugins: [
      {
        name: "version-badge-fixture",
        setup(build) {
          build.onResolve({ filter: /^react$/ }, () => ({
            path: "react",
            namespace: "fixture",
          }))
          build.onResolve({ filter: /contexts\/socket-context$/ }, () => ({
            path: "socket",
            namespace: "fixture",
          }))
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents:
              path === "react"
                ? `export const useState = () => [${JSON.stringify(version)}, () => {}]; export const useEffect = () => {};`
                : `export const useSocket = () => ({ socket: {}, isConnected: ${connected} }); export const useEvent = () => {};`,
            loader: "js",
          }))
        },
      },
    ],
  })
  const module = { exports: {} }
  runInNewContext(result.outputFiles[0].text, {
    require,
    module,
    exports: module.exports,
  })
  return renderToStaticMarkup(module.exports.default())
}

const commit = "a".repeat(40)

test("the latest installed version is white and identifies its commit", async () => {
  const html = await renderBadge({
    currentCommit: commit,
    latestCommit: commit,
    status: "current",
  })
  assert.match(html, /text-white/)
  assert.match(html, /Version aaaaaaa/)
  assert.match(html, /À jour/)
  assert.doesNotMatch(html, /text-orange-400/)
})

test("an available version is orange with the update instruction", async () => {
  const html = await renderBadge({
    currentCommit: commit,
    latestCommit: "b".repeat(40),
    status: "update",
  })
  assert.match(html, /text-orange-400/)
  assert.match(html, /Mise à jour disponible/)
  assert.match(html, /razzia-update --activate/)
})

test("unknown, loading, and disconnected states do not claim to be up to date", async () => {
  for (const [version, connected, label] of [
    [
      { currentCommit: commit, latestCommit: null, status: "unavailable" },
      true,
      "Vérification indisponible",
    ],
    [null, true, "Vérification…"],
    [
      { currentCommit: commit, latestCommit: commit, status: "current" },
      false,
      "Hors connexion",
    ],
  ]) {
    const html = await renderBadge(version, connected)
    assert.match(html, /text-slate-400/)
    assert.ok(html.includes(label))
    assert.doesNotMatch(html, /text-white|text-orange-400/)
  }
})
