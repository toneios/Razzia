import { randomUUID } from "node:crypto"
import fs from "node:fs"
import { resolve, join } from "node:path"
import { getPath } from "@razzia/socket/services/config"
import { z } from "zod"

const kindSchema = z.enum(["audio", "image", "video"])

export type LocalMediaKind = z.infer<typeof kindSchema>

const folders = { audio: "music", image: "image", video: "video" } as const
const extensions = {
  audio: /\.mp3$/iu,
  image: /\.(?:png|jpe?g|webp)$/iu,
  video: /\.(?:mp4|webm)$/iu,
}
const directory = (kind: LocalMediaKind) =>
  process.env[`${folders[kind].toUpperCase()}_PATH`] ??
  resolve(process.cwd(), "../..", folders[kind])

export const listLocalMedia = (input: unknown) => {
  const kind = kindSchema.parse(input)
  const dir = directory(kind)
  fs.mkdirSync(dir, { recursive: true })
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions[kind].test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))

  return { kind, files }
}

export const importLocalMedia = (input: unknown) => {
  const { kind, name } = z
    .object({ kind: kindSchema, name: z.string() })
    .parse(input)

  if (!listLocalMedia(kind).files.includes(name)) {
    throw new Error("Unknown media")
  }

  const source = join(directory(kind), name)
  const stat = fs.lstatSync(source)
  const limit = { image: 20, video: 200, audio: 100 }[kind]

  if (!stat.isFile() || stat.size < 12 || stat.size > limit * 1024 * 1024) {
    throw new Error("Invalid media size")
  }

  const fd = fs.openSync(source, "r")
  const header = Buffer.alloc(12)

  try {
    fs.readSync(fd, header, 0, 12, 0)
  } finally {
    fs.closeSync(fd)
  }

  let extension = ""

  if (
    kind === "audio" &&
    (header.toString("ascii", 0, 3) === "ID3" ||
      (header[0] === 255 && (header[1] & 224) === 224))
  ) {
    extension = "mp3"
  }

  if (kind === "image") {
    if (
      header
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      extension = "png"
    } else if (header[0] === 255 && header[1] === 216 && header[2] === 255) {
      extension = "jpg"
    } else if (
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    ) {
      extension = "webp"
    }
  }

  if (kind === "video") {
    if (header.toString("ascii", 4, 8) === "ftyp") {
      extension = "mp4"
    } else if (header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) {
      extension = "webm"
    }
  }

  if (!extension) {
    throw new Error("Invalid media format")
  }

  const destination = getPath("branding")
  fs.mkdirSync(destination, { recursive: true })
  const file = `${kind === "audio" ? "track" : kind}-${randomUUID()}.${extension}`
  fs.copyFileSync(source, join(destination, file), fs.constants.COPYFILE_EXCL)

  return { kind, url: `/branding/${file}` }
}
