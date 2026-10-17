import { useEffect, useRef, useCallback, type SyntheticEvent } from "react"
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

    return () => {
      current?.pause()
    }
  }, [media?.type, media?.url])
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

  if (media?.type === MEDIA_TYPES.VIDEO) {
    return (
      <video
        ref={setElement}
        key={`${media.url}:${media.startAt ?? 0}`}
        onLoadedMetadata={prepare}
        className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
        src={media.url}
        autoPlay={!preview}
        muted={!preview && !view.sound}
        controls={view.role !== "projection"}
      />
    )
  }

  if (media?.type === MEDIA_TYPES.AUDIO) {
    if (view.role === "player" && !preview) {
      return null
    }

    return (
      <audio
        ref={setElement}
        className="m-4 mb-2 w-auto rounded-md"
        key={`${media.url}:${media.startAt ?? 0}`}
        src={media.url}
        preload="auto"
        onLoadedMetadata={prepare}
        autoPlay={!preview}
        muted={!preview && !view.sound}
        controls={preview || view.role !== "projection"}
      />
    )
  }

  return null
}

export default QuestionMedia
