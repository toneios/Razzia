import { randomUUID } from "node:crypto"
import fs from "node:fs"
import { resolve, join } from "node:path"
import { getPath } from "@razzia/socket/services/config"

// Pnpm starts this package in packages/socket on Windows and Linux.
const musicDir = () =>
  process.env.MUSIC_PATH ?? resolve(process.cwd(), "../../music")
const tracks = () => {
  const dir = musicDir()
  fs.mkdirSync(dir, { recursive: true })

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.mp3$/iu.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
}

export const listMusic = () => tracks()

export const importMusic = (name: unknown) => {
  if (typeof name !== "string" || !tracks().includes(name)) {
    throw new Error("Unknown track")
  }

  const source = join(musicDir(), name)
  const stat = fs.lstatSync(source)

  if (!stat.isFile() || stat.size < 12 || stat.size > 100 * 1024 * 1024) {
    throw new Error("Invalid track size")
  }

  const fd = fs.openSync(source, "r")
  const header = Buffer.alloc(3)

  try {
    fs.readSync(fd, header, 0, 3, 0)
  } finally {
    fs.closeSync(fd)
  }

  if (
    header.toString("ascii") !== "ID3" &&
    !(header[0] === 255 && (header[1] & 224) === 224)
  ) {
    throw new Error("Invalid MP3")
  }

  const destination = getPath("branding")
  fs.mkdirSync(destination, { recursive: true })
  const file = `track-${randomUUID()}.mp3`
  fs.copyFileSync(source, join(destination, file), fs.constants.COPYFILE_EXCL)

  return { url: `/branding/${file}` }
}
