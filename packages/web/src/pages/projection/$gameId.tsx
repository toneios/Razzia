import { EVENTS } from "@razzia/common/constants"
import type { ProjectionSnapshot } from "@razzia/common/types/game/socket"
import { STATUS } from "@razzia/common/types/game/status"
import GameWrapper from "@razzia/web/features/game/components/GameWrapper"
import {
  socketClient,
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { GameViewContext } from "@razzia/web/features/game/contexts/view-context"
import { useQuestionStore } from "@razzia/web/features/game/stores/question"
import {
  GAME_STATE_COMPONENTS_MANAGER,
  isKeyOf,
} from "@razzia/web/features/game/utils/constants"
import { createFileRoute } from "@tanstack/react-router"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const ProjectionPage = () => {
  const { gameId } = Route.useParams()
  const { socket, isConnected } = useSocket()
  const { setQuestionStates } = useQuestionStore()
  const [snapshot, setSnapshot] = useState<ProjectionSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const { t } = useTranslation()

  useEvent(EVENTS.PROJECTION.SNAPSHOT, (data) => {
    setRevision((value) => value + 1)
    setError(null)
    setSnapshot(data)
    setQuestionStates(data.currentQuestion)
  })
  useEvent(EVENTS.GAME.STATUS, (status) =>
    setSnapshot(
      (previous) =>
        previous && { ...previous, status, remaining: null, answers: 0 },
    ),
  )
  useEvent(EVENTS.PROJECTION.PLAYERS, (players) =>
    setSnapshot((previous) => previous && { ...previous, players }),
  )
  useEvent(EVENTS.GAME.RESET, (message) => {
    setSnapshot(null)
    setError(message)
    setQuestionStates(null)
  })

  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.PROJECTION.JOIN, { gameId })
    }

    return () => {
      socket.emit(EVENTS.PROJECTION.LEAVE)
    }
  }, [socket, isConnected, gameId])

  const status = snapshot?.status
  const Current =
    status && isKeyOf(GAME_STATE_COMPONENTS_MANAGER, status.name)
      ? GAME_STATE_COMPONENTS_MANAGER[status.name]
      : null
  const begin = () => {
    setReady(true)
    document.documentElement.requestFullscreen().catch(() => {
      /* Fullscreen is optional. */
    })
  }

  const renderContent = () => {
    if (error) {
      return (
        <p className="m-auto px-6 text-center text-3xl text-white">
          {t(error)}
        </p>
      )
    }

    if (status?.name === STATUS.SHOW_ROOM && snapshot) {
      return (
        <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center text-white">
          <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl bg-white p-8 text-black">
            <QRCodeSVG
              size={220}
              value={`${window.location.origin}/?pin=${snapshot.inviteCode}`}
            />
            <div>
              <p className="text-2xl">{t("game:joinInstruction")}</p>
              <p className="max-w-xl text-2xl font-bold break-all">
                {window.location.origin}
              </p>
              <p className="mt-5 text-2xl">{t("game:gamePinLabel")}</p>
              <p className="text-7xl font-extrabold tracking-wider">
                {snapshot.inviteCode}
              </p>
            </div>
          </div>
          <h1 className="text-4xl font-bold">{t("game:waitingForPlayers")}</h1>
          <p className="text-3xl">
            {t("game:playersJoined")}
            {snapshot.players.length}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {snapshot.players.map((name, index) => (
              <span
                key={index}
                className="rounded-xl bg-black/30 px-4 py-2 text-3xl font-bold"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )
    }

    if (Current && status) {
      return (
        <Current
          key={`${revision}:${status.name}`}
          data={status.data as never}
        />
      )
    }

    return (
      <p className="m-auto text-3xl text-white">{t("common:connecting")}</p>
    )
  }

  return (
    <GameViewContext.Provider
      value={{
        role: "projection",
        sound: ready,
        remaining: snapshot?.remaining,
        answers: snapshot?.answers,
      }}
    >
      {!isConnected && (
        <div className="fixed inset-x-0 top-0 z-50 bg-amber-600 p-3 text-center font-bold text-white">
          {t("common:connecting")}
        </div>
      )}
      {!ready && (
        <div className="fixed right-4 bottom-4 z-50">
          <button
            onClick={begin}
            className="rounded-xl bg-white px-6 py-4 font-bold text-black shadow-xl"
          >
            {t("game:beginProjection")}
          </button>
        </div>
      )}
      <GameWrapper statusName={status?.name} manager>
        {renderContent()}
      </GameWrapper>
    </GameViewContext.Provider>
  )
}

export const Route = createFileRoute("/projection/$gameId")({
  component: ProjectionPage,
  onLeave: () => {
    socketClient.emit(EVENTS.PROJECTION.LEAVE)
  },
})
