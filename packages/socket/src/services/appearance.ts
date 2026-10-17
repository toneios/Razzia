import {
  appearanceSchema,
  DEFAULT_APPEARANCE,
} from "@razzia/common/types/appearance"
import { getPath } from "@razzia/socket/services/config"
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { z } from "zod"

const readTheme = (): Record<string, unknown> => {
  const path = getPath("branding/theme.json")

  if (!existsSync(path)) {
    return {}
  }

  const parsed = z
    .record(z.string(), z.unknown())
    .safeParse(JSON.parse(readFileSync(path, "utf8")))

  if (!parsed.success) {
    throw new Error("Invalid theme")
  }

  return parsed.data
}

export const getAppearance = () => {
  const theme = readTheme()
  const colors = z.record(z.string(), z.string()).safeParse(theme.colors)
  const music = z.record(z.string(), z.unknown()).safeParse(theme.music)
  const parsed = appearanceSchema.safeParse({
    ...DEFAULT_APPEARANCE,
    ...theme,
    colors: {
      ...DEFAULT_APPEARANCE.colors,
      ...(colors.success ? colors.data : {}),
    },
    music: {
      ...DEFAULT_APPEARANCE.music,
      ...(music.success ? music.data : {}),
    },
  })

  return parsed.success ? parsed.data : DEFAULT_APPEARANCE
}

export const saveAppearance = (data: unknown) => {
  const appearance = appearanceSchema.parse(data)
  const theme = readTheme()
  const colors = z.record(z.string(), z.string()).safeParse(theme.colors)
  const dir = getPath("branding")
  mkdirSync(dir, { recursive: true })
  const temp = join(dir, `theme-${randomUUID()}.tmp`)
  writeFileSync(
    temp,
    JSON.stringify(
      {
        ...theme,
        ...appearance,
        colors: {
          ...(colors.success ? colors.data : {}),
          ...appearance.colors,
        },
      },
      null,
      2,
    ),
  )
  renameSync(temp, join(dir, "theme.json"))
}

const uploadSchema = z.object({
  kind: z.enum(["background", "music"]),
  base64: z
    .string()
    .min(4)
    .max(21 * 1024 * 1024)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/u),
})

export const uploadAppearanceMedia = (data: unknown) => {
  const { kind, base64 } = uploadSchema.parse(data)
  const bytes = Buffer.from(base64, "base64")

  if (
    bytes.length > (kind === "background" ? 4 : 15) * 1024 * 1024 ||
    bytes.length < 12
  ) {
    throw new Error("Invalid media size")
  }

  const header = bytes.subarray(0, 12)
  let extension = ""

  if (kind === "background") {
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
  } else if (
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WAVE"
  ) {
    extension = "wav"
  } else if (
    header.toString("ascii", 0, 3) === "ID3" ||
    (header[0] === 255 && (header[1] & 224) === 224)
  ) {
    extension = "mp3"
  }

  if (!extension) {
    throw new Error("Unsupported media")
  }

  const dir = getPath("branding")
  mkdirSync(dir, { recursive: true })
  const name = `${kind}-${randomUUID()}.${extension}`
  writeFileSync(join(dir, name), bytes)

  return { kind, url: `/branding/${name}` }
}
