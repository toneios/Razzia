import { z } from "zod"

const color = z.string().regex(/^#[0-9a-f]{6}$/iu)
const mediaUrl = z
  .string()
  .max(2048)
  .refine(
    (value) =>
      value === "" ||
      /^\/(?:branding|sounds)\/[a-zA-Z0-9_.-]+$/u.test(value) ||
      /^https?:\/\//u.test(value),
  )

export const appearanceSchema = z.object({
  colors: z.object({ primary: color, secondary: color, brand: color }),
  answerColors: z.array(color).length(4),
  background: mediaUrl,
  music: z.object({
    url: mediaUrl,
    enabled: z.boolean(),
    volume: z.number().min(0).max(1),
  }),
})

export type Appearance = z.infer<typeof appearanceSchema>

export const DEFAULT_APPEARANCE: Appearance = {
  colors: { primary: "#896641", secondary: "#0c0c10", brand: "#b3986e" },
  answerColors: ["#9a5c16", "#185e90", "#126951", "#7e3977"],
  background: "",
  music: { url: "/sounds/answersMusic.mp3", enabled: true, volume: 0.2 },
}
