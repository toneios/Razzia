import { EVENTS } from "@razzia/common/constants"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const MusicLibrary = () => {
  const { socket, isConnected } = useSocket()
  const { currentQuestion, questions, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const [kind, setKind] = useState<"audio" | "image" | "video">("audio")
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const target = useRef<string | null>(null)
  useEvent(
    EVENTS.MEDIA_LIBRARY.FILES,
    ({ kind: receivedKind, files: names }) => {
      if (receivedKind !== kind) {
        return
      }

      setFiles(names)
      setLoaded(true)
      setSelected((previous) =>
        names.includes(previous) ? previous : (names[0] ?? ""),
      )
    },
  )
  useEvent(EVENTS.MEDIA_LIBRARY.IMPORTED, ({ kind: mediaKind, url }) => {
    if (!target.current) {
      return
    }

    const index = questions.findIndex(
      (question) => question.id === target.current,
    )

    if (index >= 0) {
      updateQuestion(index, { media: { type: mediaKind, url, startAt: 0 } })
    }

    target.current = null
    setBusy(false)
    toast.success(t("quizz:blindTest.uploaded"))
  })
  useEvent(EVENTS.MEDIA_LIBRARY.ERROR, (message) => {
    target.current = null
    setBusy(false)
    toast.error(t(message))
  })
  useEffect(() => {
    if (isConnected) {
      socket.emit(EVENTS.MEDIA_LIBRARY.LIST, kind)
    }
  }, [socket, isConnected, kind])
  useEffect(() => {
    if (!busy) {
      return
    }

    const timer = window.setTimeout(() => {
      target.current = null
      setBusy(false)
      toast.error(t("quizz:blindTest.mediaError"))
    }, 45000)

    return () => window.clearTimeout(timer)
  }, [busy, t])

  return (
    <div className="w-full text-sm text-slate-100">
      <label className="mb-2 block">
        {t("quizz:blindTest.mediaType")}
        <select
          className="ml-2 rounded-lg border border-slate-700 bg-slate-950 p-2"
          value={kind}
          disabled={busy}
          onChange={(event) => {
            const { value } = event.target

            if (value === "audio" || value === "image" || value === "video") {
              setKind(value)
              setFiles([])
              setSelected("")
              setLoaded(false)
            }
          }}
        >
          <option value="audio">music · MP3</option>
          <option value="image">image · PNG / JPG / WebP</option>
          <option value="video">video · MP4 / WebM</option>
        </select>
      </label>
      <select
        aria-label={t("quizz:blindTest.choose")}
        id="music-library"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2"
        value={selected}
        disabled={busy || !isConnected}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">{t("quizz:blindTest.choose")}</option>
        {files.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
      {loaded && files.length === 0 && (
        <p className="my-2">{t("quizz:blindTest.libraryEmpty")}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 disabled:opacity-40"
          disabled={busy || !isConnected}
          onClick={() => socket.emit(EVENTS.MEDIA_LIBRARY.LIST, kind)}
        >
          {t("quizz:blindTest.refresh")}
        </button>
        <button
          type="button"
          className="rounded-lg bg-amber-200 px-3 py-2 font-semibold text-slate-950 disabled:opacity-40"
          disabled={busy || !isConnected || !selected}
          onClick={() => {
            target.current = currentQuestion.id
            setBusy(true)
            socket.emit(EVENTS.MEDIA_LIBRARY.IMPORT, { kind, name: selected })
          }}
        >
          {t(busy ? "quizz:blindTest.sending" : "quizz:blindTest.useMedia")}
        </button>
      </div>
    </div>
  )
}

export default MusicLibrary
