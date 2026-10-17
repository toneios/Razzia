import { EVENTS } from "@razzia/common/constants"
import Background from "@razzia/web/components/Background"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { saveProjectionToken } from "@razzia/web/features/game/utils/projection-session"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const ProjectionAccessPage = () => {
  const { socket, isConnected } = useSocket()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEvent(EVENTS.PROJECTION.AUTHORIZED, ({ gameId, token }) => {
    setPassword("")
    setPending(false)

    try {
      saveProjectionToken(gameId, token)
      navigate({ to: "/projection/$gameId", params: { gameId } })
    } catch {
      setError("game:projectionStorageError")
    }
  })
  useEvent(EVENTS.PROJECTION.AUTH_ERROR, (message) => {
    setPending(false)
    setError(message)
  })

  useEffect(() => {
    if (!pending) {
      return
    }

    const timeout = window.setTimeout(() => {
      setPending(false)
      setError("game:projectionTimeout")
    }, 10000)

    return () => window.clearTimeout(timeout)
  }, [pending])

  return (
    <Background>
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-black/50 p-6 text-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()

          if (!isConnected || pending) {
            return
          }

          setError("")
          setPending(true)
          socket.emit(EVENTS.PROJECTION.OPEN, {
            password,
            inviteCode: pin.trim(),
          })
        }}
      >
        <h2 className="text-2xl font-bold">{t("game:projectionAccess")}</h2>
        <p className="mt-2 mb-6 text-sm text-white/70">
          {t("game:projectionAccessHelp")}
        </p>
        <label className="mb-4 block" htmlFor="projection-password">
          {t("game:projectionPassword")}
          <input
            id="projection-password"
            className="mt-2 w-full rounded-lg bg-white px-4 py-3 text-black"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={4096}
          />
        </label>
        <label className="mb-6 block" htmlFor="projection-pin">
          {t("game:gamePinLabel")}
          <input
            id="projection-pin"
            className="mt-2 w-full rounded-lg bg-white px-4 py-3 text-center text-2xl tracking-widest text-black"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/[^0-9]/gu, ""))
            }
            required
            placeholder="000000"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-300/40 bg-red-950/70 p-3 text-red-100"
          >
            {t(error)}
          </p>
        )}
        <button
          className="bg-primary w-full rounded-lg px-4 py-3 font-bold text-white disabled:opacity-50"
          type="submit"
          disabled={!isConnected || pending}
        >
          {!isConnected
            ? t("common:connecting")
            : t(pending ? "game:projectionChecking" : "game:openProjection")}
        </button>
      </form>
    </Background>
  )
}

export const Route = createFileRoute("/projection/")({
  component: ProjectionAccessPage,
})
