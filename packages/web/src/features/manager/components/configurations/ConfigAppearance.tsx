import { EVENTS } from "@razzia/common/constants"
import {
  DEFAULT_APPEARANCE,
  type Appearance,
} from "@razzia/common/types/appearance"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const ConfigAppearance = () => {
  const { socket, isConnected } = useSocket()
  const { t } = useTranslation()
  const [draft, setDraft] = useState<Appearance>(DEFAULT_APPEARANCE)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  useEvent(EVENTS.APPEARANCE.DATA, (data) => {
    setDraft(data)
    setLoaded(true)
  })
  useEvent(EVENTS.APPEARANCE.SAVED, () => {
    setBusy(false)
    setMessage("manager:appearance.saved")
  })
  useEvent(EVENTS.APPEARANCE.ERROR, (error) => {
    setBusy(false)
    setMessage(error)
  })
  useEvent(EVENTS.APPEARANCE.UPLOADED, ({ kind, url }) => {
    setBusy(false)
    setDraft((previous) =>
      kind === "background"
        ? { ...previous, background: url }
        : { ...previous, music: { ...previous.music, url } },
    )
    setMessage("manager:appearance.uploaded")
  })
  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.APPEARANCE.GET)
    }
  }, [socket, isConnected])
  useEffect(() => {
    if (!busy) {
      return
    }

    const timeout = window.setTimeout(() => {
      setBusy(false)
      setMessage("manager:appearance.timeout")
    }, 45000)

    return () => window.clearTimeout(timeout)
  }, [busy])
  const upload = (kind: "background" | "music", file: File | undefined) => {
    if (!file) {
      return
    }

    if (file.size > (kind === "background" ? 4 : 15) * 1024 * 1024) {
      setMessage("manager:appearance.uploadError")

      return
    }

    setBusy(true)
    setMessage("")
    const reader = new FileReader()
    reader.onerror = () => {
      setBusy(false)
      setMessage("manager:appearance.uploadError")
    }
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setBusy(false)

        return
      }

      socket.emit(EVENTS.APPEARANCE.UPLOAD, {
        kind,
        base64: reader.result.split(",")[1],
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <form
      className="flex min-h-0 flex-col gap-4 overflow-y-auto px-1 pb-2"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        setMessage("")
        socket.emit(EVENTS.APPEARANCE.SAVE, draft)
      }}
    >
      <p className="text-sm text-gray-600">{t("manager:appearance.help")}</p>
      <fieldset
        disabled={!loaded || busy || !isConnected}
        className="flex flex-col gap-4 disabled:opacity-50"
      >
        <div className="grid grid-cols-3 gap-3">
          {(["primary", "secondary", "brand"] as const).map((name) => (
            <label key={name} className="text-sm">
              {t(`manager:appearance.${name}`)}
              <input
                aria-label={t(`manager:appearance.${name}`)}
                className="mt-1 h-10 w-full"
                type="color"
                value={draft.colors[name]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    colors: { ...draft.colors, [name]: event.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div>
          <p className="mb-2 text-sm">{t("manager:appearance.answers")}</p>
          <div className="grid grid-cols-4 gap-3">
            {draft.answerColors.map((color, index) => (
              <label key={index} className="text-center text-sm">
                {String.fromCharCode(65 + index)}
                <input
                  aria-label={`${t("manager:appearance.answers")} ${String.fromCharCode(65 + index)}`}
                  className="mt-1 h-10 w-full"
                  type="color"
                  value={color}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      answerColors: draft.answerColors.map((value, position) =>
                        position === index ? event.target.value : value,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: draft.colors.secondary }}
        >
          <p
            className="mb-3 text-lg font-bold"
            style={{ color: draft.colors.brand }}
          >
            AS Event · Quiz Live
          </p>
          <div className="grid grid-cols-4 gap-2">
            {draft.answerColors.map((color, index) => (
              <span
                key={index}
                className="rounded p-2 text-center font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {String.fromCharCode(65 + index)}
              </span>
            ))}
          </div>
        </div>
        <label className="text-sm font-semibold">
          {t("manager:appearance.background")}
          <input
            className="mt-2 w-full text-sm"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => upload("background", event.target.files?.[0])}
          />
        </label>
        {draft.background && (
          <img
            className="max-h-32 w-full rounded-lg object-cover"
            src={draft.background}
            alt={t("manager:appearance.background")}
          />
        )}
        <button
          type="button"
          className="text-left text-sm underline"
          onClick={() => setDraft({ ...draft, background: "" })}
        >
          {t("manager:appearance.defaultBackground")}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.music.enabled}
            onChange={(event) =>
              setDraft({
                ...draft,
                music: { ...draft.music, enabled: event.target.checked },
              })
            }
          />
          {t("manager:appearance.musicEnabled")}
        </label>
        <label className="text-sm font-semibold">
          {t("manager:appearance.music")}
          <input
            className="mt-2 w-full text-sm"
            type="file"
            accept="audio/mpeg,audio/wav,.mp3,.wav"
            onChange={(event) => upload("music", event.target.files?.[0])}
          />
        </label>
        <audio
          key={draft.music.url}
          src={draft.music.url || "/sounds/answersMusic.mp3"}
          controls
          preload="none"
          className="w-full"
        />
        <label className="text-sm">
          {t("manager:appearance.volume")} :{" "}
          {Math.round(draft.music.volume * 100)} %
          <input
            aria-label={t("manager:appearance.volume")}
            className="mt-2 w-full"
            type="range"
            min="0"
            max="100"
            value={Math.round(draft.music.volume * 100)}
            onChange={(event) =>
              setDraft({
                ...draft,
                music: {
                  ...draft.music,
                  volume: Number(event.target.value) / 100,
                },
              })
            }
          />
        </label>
        <button
          type="button"
          className="text-left text-sm underline"
          onClick={() =>
            setDraft({ ...draft, music: DEFAULT_APPEARANCE.music })
          }
        >
          {t("manager:appearance.defaultMusic")}
        </button>
        <button
          type="button"
          className="rounded-lg border px-4 py-2"
          onClick={() => setDraft(DEFAULT_APPEARANCE)}
        >
          {t("manager:appearance.reset")}
        </button>
        <button
          type="submit"
          className="bg-primary rounded-lg px-4 py-3 font-bold text-white"
        >
          {t("manager:appearance.save")}
        </button>
      </fieldset>
      {!isConnected && <p role="status">{t("common:connecting")}</p>}
      {busy && <p role="status">{t("manager:appearance.sending")}</p>}
      {message && (
        <p role="status" className="rounded-lg bg-gray-100 p-3 text-sm">
          {t(message)}
        </p>
      )}
    </form>
  )
}

export default ConfigAppearance
