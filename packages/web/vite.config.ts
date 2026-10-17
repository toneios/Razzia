import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"
import { fileURLToPath } from "url"
import { defineConfig, type Plugin } from "vite"
import { version } from "../../package.json"

const brandingDir = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH, "branding")
  : fileURLToPath(new URL("../../config/branding", import.meta.url))

const brandingMimeTypes: Record<string, string> = {
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".css": "text/css",
  ".woff2": "font/woff2",
}

const serveBranding = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void => {
  if (!req.url?.startsWith("/branding/")) {
    next()

    return
  }

  let relative = ""

  try {
    relative = decodeURIComponent(
      req.url.replace(/^\/branding\//, "").split("?")[0],
    )
  } catch {
    res.statusCode = 400
    res.end()

    return
  }

  // Branding assets are flat files, never paths into the rest of the config.
  if (
    !/^[a-zA-Z0-9_.-]+$/u.test(relative) ||
    relative === "." ||
    relative === ".."
  ) {
    res.statusCode = 404
    res.end()

    return
  }

  const filePath = path.join(brandingDir, relative)

  if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
    res.statusCode = 404
    res.end()

    return
  }

  const { size } = fs.statSync(filePath)
  res.setHeader(
    "Content-Type",
    brandingMimeTypes[path.extname(filePath)] ?? "application/octet-stream",
  )
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Accept-Ranges", "bytes")
  let start = 0
  let end = size - 1

  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(req.headers.range)

    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
      end =
        match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
    }

    if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
      res.statusCode = 416
      res.setHeader("Content-Range", `bytes */${size}`)
      res.end()

      return
    }

    res.statusCode = 206
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`)
  }

  res.setHeader("Content-Length", Math.max(0, end - start + 1))

  if (req.method === "HEAD" || size === 0) {
    res.end()

    return
  }

  const stream = fs.createReadStream(filePath, { start, end })
  stream.on("error", () => res.destroy())
  res.on("close", () => stream.destroy())
  stream.pipe(res)
}

/** Serves the optional `config/branding` folder at `/branding/` in `vite dev` and `vite preview` (nginx does this in prod). */
const brandingServer = (): Plugin => ({
  name: "razzia-branding-server",
  configureServer(server) {
    server.middlewares.use(serveBranding)
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveBranding)
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      routeToken: "layout",
      routesDirectory: "./src/pages",
      generatedRouteTree: "./src/route.gen.ts",
    }),
    react(),
    tailwindcss(),
    brandingServer(),
  ],
  resolve: {
    alias: {
      "@razzia/web": fileURLToPath(new URL("./src", import.meta.url)),
      "@razzia/common": fileURLToPath(
        new URL("../common/src", import.meta.url),
      ),
      "@razzia/socket": fileURLToPath(
        new URL("../socket/src", import.meta.url),
      ),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/ws": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
