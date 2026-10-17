// React development effects may attach, detach and attach the same player.
// Each attachment must explicitly resume; autoplay alone only runs on mount.
export const attachMediaPlayback = (
  media: Pick<HTMLMediaElement, "play" | "pause">,
  onBlocked: (_error: unknown) => void,
) => {
  let active = true
  void media.play().catch((error: unknown) => {
    if (active && !(error instanceof Error && error.name === "AbortError")) {
      onBlocked(error)
    }
  })

  return () => {
    active = false
    media.pause()
  }
}
