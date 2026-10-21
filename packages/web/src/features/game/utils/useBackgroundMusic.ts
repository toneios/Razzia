import { useBranding } from "@razzia/web/branding"
import {
  useGameView,
  useGameSound,
} from "@razzia/web/features/game/contexts/view-context"
import { useEffect } from "react"

export const useBackgroundMusic = (questionHasMedia = false) => {
  const { music } = useBranding()
  const view = useGameView()
  // The projection carries the room music; the control desk can opt in.
  const enabled =
    (music?.enabled ?? true) && view.role !== "player" && !questionHasMedia
  const [play, { stop }] = useGameSound(
    // Empty URLs also select the built-in music.
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing
    music?.url || "/sounds/answersMusic.mp3",
    {
      volume: music?.volume ?? 0.2,
      loop: true,
      interrupt: true,
      soundEnabled: enabled,
    },
  )
  useEffect(() => {
    if (enabled) {
      play()
    }

    return () => {
      stop()
    }
  }, [play, stop, enabled])
}
