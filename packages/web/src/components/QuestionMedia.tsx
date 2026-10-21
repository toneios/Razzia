import { attachMediaPlayback } from "@razzia/web/features/game/utils/media-playback"
import { useTranslation } from "react-i18next"
import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type SyntheticEvent,
} from "react"
import { MEDIA_TYPES } from "@razzia/common/constants"
import type { QuestionMedia as QuestionMediaType } from "@razzia/common/types/game"

import { useGameView } from "@razzia/web/features/game/contexts/view-context"

interface Props {
  media?: QuestionMediaType
  alt?: string
  preview?: boolean
}

const QuestionMedia = ({ media, alt = "", preview = false }: Props) => {
  const view = useGameView()
  const { t } = useTranslation()
  const [issue, setIssue] = useState<"blocked" | "error" | null>(null)
  const element = useRef<HTMLMediaElement>(null)
  const setElement = useCallback((current: HTMLMediaElement | null) => {
    element.current = current
  }, [])
  useEffect(() => {
    if (element.current) {
      element.current.volume = media?.volume ?? 1
    }
  }, [media?.volume, media?.type, media?.url])
  useEffect(() => {
    const { current } = element
    setIssue(null)

    if (!current || preview) {
      return
    }

    return attachMediaPlayback(current, (error) =>
      setIssue(
        error instanceof Error && error.name === "NotSupportedError"
          ? "error"
          : "blocked",
      ),
    )
  }, [media?.type, media?.url, media?.startAt, preview, view.sound])
  const prepare = (event: SyntheticEvent<HTMLMediaElement>) => {
    const current = event.currentTarget
    current.volume = media?.volume ?? 1
    current.currentTime = Math.min(
      media?.startAt ?? 0,
      Math.max(0, current.duration - 0.1),
    )
  }

  if (media?.type === MEDIA_TYPES.IMAGE) {
    return (
      <img
        alt={alt}
        src={media.url}
        className="max-h-60 w-auto rounded-md sm:max-h-100"
      />
    )
  }

  const feedback = issue && (
    <div
      role="status"
      className="rounded-xl border border-amber-400/40 bg-slate-950 p-3 text-center text-sm text-white"
    >
      {issue === "error" ? (
        t("game:mediaError")
      ) : (
        <button
          type="button"
          className="rounded-lg bg-white px-4 py-2 font-bold text-black"
          onClick={() => {
            const { current } = element

            if (current) {
              void current
                .play()
                .then(() => setIssue(null))
                .catch(() => setIssue("blocked"))
            }
          }}
        >
          {t("game:playMedia")}
        </button>
      )}
    </div>
  )

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <video
          ref={setElement}
          onError={() => setIssue("error")}
          onPlaying={() => setIssue(null)}
          key={`${media.url}:${media.startAt ?? 0}`}
          onLoadedMetadata={prepare}
          className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
          src={media.url}
          muted={!preview && !view.sound}
          controls={preview || view.role !== "projection"}
        />
        {feedback}
      </div>
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    if (view.role === "player" && !preview) {
      return null
    }

    return (
      <div className="flex w-full flex-col items-center gap-2">
        <audio
          ref={setElement}
          onError={() => setIssue("error")}
          onPlaying={() => setIssue(null)}
          className="m-4 mb-2 w-auto rounded-md"
          key={`${media.url}:${media.startAt ?? 0}`}
          src={media.url}
          preload="auto"
          onLoadedMetadata={prepare}
          muted={!preview && !view.sound}
          controls={preview || view.role !== "projection"}
        />
        {feedback}
      </div>
    )
  }

  return null
}

export default QuestionMedia
