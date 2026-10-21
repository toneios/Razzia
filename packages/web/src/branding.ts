import asEventLogo from "@razzia/web/assets/as-event-logo.png"
import { useSyncExternalStore, type ReactEventHandler } from "react"
import {
  appearanceSchema,
  DEFAULT_APPEARANCE,
} from "@razzia/common/types/appearance"
import { z } from "zod"

const brandingSchema = z.object({
  appName: z.string().optional(),
  colors: z.record(z.string(), z.string()).optional(),
  answerColors: z.array(z.string()).optional(),
  font: z.object({ family: z.string(), url: z.string().optional() }).optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  background: z.string().optional(),
  music: appearanceSchema.shape.music.optional(),
})

export type BrandingTheme = z.infer<typeof brandingSchema>

const defaultBranding: BrandingTheme = {
  ...DEFAULT_APPEARANCE,
  appName: "AS Event · Quiz Live",
  logo: asEventLogo,
  favicon: asEventLogo,
}

let current: BrandingTheme = defaultBranding

const listeners = new Set<() => void>()

export const useBranding = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    () => current,
  )

export const getBranding = (): BrandingTheme | null => current

export const loadBranding = async (): Promise<BrandingTheme | null> => {
  try {
    const response = await fetch("/branding/theme.json", {
      cache: "no-cache",
      signal: AbortSignal.timeout(2000),
    })

    if (!response.ok) {
      return current
    }

    const parsed = brandingSchema.safeParse(await response.json())
    current = parsed.success
      ? { ...defaultBranding, ...parsed.data }
      : defaultBranding

    listeners.forEach((listener) => {
      listener()
    })

    return current
  } catch {
    return current
  }
}

export const applyBranding = (theme: BrandingTheme | null): void => {
  if (!theme) {
    return
  }

  const root = document.documentElement

  if (theme.colors) {
    for (const [name, value] of Object.entries(theme.colors)) {
      root.style.setProperty(`--color-${name}`, value)
    }
  }

  theme.answerColors?.forEach((color, index) => {
    root.style.setProperty(`--color-answer-${index + 1}`, color)
  })

  if (theme.font) {
    if (theme.font.url) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = theme.font.url
      document.head.appendChild(link)
    }

    root.style.setProperty(
      "--font-display",
      `"${theme.font.family}", sans-serif`,
    )
  }

  if (theme.appName) {
    document.title = theme.appName
  }

  if (theme.favicon) {
    const favicon = document.querySelector<HTMLLinkElement>("link#favicon")

    if (favicon) {
      favicon.href = theme.favicon
    }
  }
}

export const imageFallback =
  (fallback: string): ReactEventHandler<HTMLImageElement> =>
  (event) => {
    event.currentTarget.onerror = null
    event.currentTarget.src = fallback
  }
