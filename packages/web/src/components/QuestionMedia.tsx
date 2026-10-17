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
        className="m-4 mb-2 aspect-video max-h-60 w-auto rounded-md px-4 sm:max-h-100"
        src={media.url}
        autoPlay
        muted={!view.sound}
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
        className="m-4 mb-2 w-auto rounded-md"
        key={`${media.url}:${media.startAt ?? 0}`}
        src={media.url}
        preload="auto"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          audio.currentTime = Math.min(
            media.startAt ?? 0,
            Math.max(0, audio.duration - 0.1),
          )
        }}
        autoPlay={!preview}
        muted={!preview && !view.sound}
        controls={preview || view.role !== "projection"}
      />
    )
  }

  return null
}

export default QuestionMedia
