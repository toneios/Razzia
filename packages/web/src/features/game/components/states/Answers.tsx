import { EVENTS, NO_TIME_LIMIT } from "@razzia/common/constants"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { SFX } from "@razzia/web/features/game/utils/constants"
import { QUESTION_REGISTRY } from "@razzia/web/features/questions"
import { useBackgroundMusic } from "@razzia/web/features/game/utils/useBackgroundMusic"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useGameView,
  useGameSound as useSound,
} from "@razzia/web/features/game/contexts/view-context"

interface Props {
  data: CommonStatusDataMap["SELECT_ANSWER"]
}

const Answers = ({
  data: { question, answers, media, time, totalPlayer, questionType, options },
}: Props) => {
  const { socket } = useSocket()
  const { player, gameId } = usePlayerStore()

  const view = useGameView()
  const [cooldown, setCooldown] = useState(view.remaining ?? time)
  const [totalAnswer, setTotalAnswer] = useState(view.answers ?? 0)
  const { t } = useTranslation()

  const [sfxPop] = useSound(SFX.ANSWERS.SOUND, {
    volume: 0.1,
  })

  useBackgroundMusic(Boolean(media?.type))

  const handleSubmit = (answerKeys: number[]) => {
    if (view.role !== "player" || !player || !gameId) {
      return
    }

    socket.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId,
      data: {
        answerKeys,
      },
    })
    sfxPop()
  }

  useEvent(EVENTS.GAME.COOLDOWN, (sec) => {
    setCooldown(sec)
  })

  useEvent(EVENTS.GAME.PLAYER_ANSWER, (count) => {
    setTotalAnswer(count)
    sfxPop()
  })

  const { AnswerComponent } = QUESTION_REGISTRY[questionType]

  return (
    <div className="flex h-full flex-1 flex-col justify-between">
      <div className="mx-auto inline-flex h-full w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5">
        <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
          {question}
        </h2>

        <QuestionMedia media={media} alt={question} />
      </div>

      <div>
        <div className="mx-auto mb-4 flex w-full max-w-7xl justify-between gap-1 px-2 text-lg font-bold text-white md:text-xl">
          {time !== NO_TIME_LIMIT && (
            <div className="flex flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
              <span className="translate-y-1 text-sm">
                {t("game:hud.time")}
              </span>
              <span>{cooldown}</span>
            </div>
          )}
          <div className="flex flex-col items-center rounded-lg bg-black/40 px-4 text-lg font-bold">
            <span className="translate-y-1 text-sm">
              {t("game:hud.answers")}
            </span>
            <span>
              {totalAnswer}/{totalPlayer}
            </span>
          </div>
        </div>

        <AnswerComponent
          answers={answers}
          options={options}
          onSubmit={handleSubmit}
          readOnly={view.role !== "player" || !player}
        />
      </div>
    </div>
  )
}

export default Answers
