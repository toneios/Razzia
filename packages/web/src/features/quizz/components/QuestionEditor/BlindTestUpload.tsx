import { EVENTS } from "@razzia/common/constants"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import toast from "react-hot-toast"

const BlindTestUpload = () => {
  const { socket, isConnected } = useSocket()
  const { currentQuestion, questions, updateQuestion } = useQuizzEditor()
  const { t } = useTranslation()
  const target = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEvent(EVENTS.APPEARANCE.UPLOADED, ({ kind, url }) => {
    if (!target.current || kind !== "music") {
      return
    }

    const index = questions.findIndex(
      (question) => question.id === target.current,
    )

    if (index >= 0) {
      updateQuestion(index, { media: { type: "audio", url, startAt: 0 } })
    }

    target.current = null
    setBusy(false)
    toast.success(t("quizz:blindTest.uploaded"))
  })
  useEvent(EVENTS.APPEARANCE.ERROR, () => {
    if (!target.current) {
      return
    }

    target.current = null
    setBusy(false)
    toast.error(t("quizz:blindTest.error"))
  })
  useEffect(() => {
    if (!busy) {
      return
    }

    const timer = window.setTimeout(() => {
      target.current = null
      setBusy(false)
      toast.error(t("quizz:blindTest.error"))
    }, 45000)

    return () => window.clearTimeout(timer)
  }, [busy, t])

  return (
    <label className="w-full text-sm text-slate-200">
      <span className="font-bold">{t("quizz:blindTest.import")}</span>
      <input
        className="mt-2 block w-full"
        type="file"
        accept="audio/mpeg,audio/wav,.mp3,.wav"
        disabled={busy || !isConnected}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""

          if (!file) {
            return
          }

          if (file.size > 15 * 1024 * 1024) {
            toast.error(t("quizz:blindTest.error"))

            return
          }

          target.current = currentQuestion.id
          setBusy(true)
          const reader = new FileReader()
          reader.onerror = () => {
            target.current = null
            setBusy(false)
            toast.error(t("quizz:blindTest.error"))
          }
          reader.onload = () => {
            if (!target.current || typeof reader.result !== "string") {
              return
            }

            socket.emit(EVENTS.APPEARANCE.UPLOAD, {
              kind: "music",
              base64: reader.result.split(",")[1],
            })
          }
          reader.readAsDataURL(file)
        }}
      />
      {busy && <p className="mt-2">{t("quizz:blindTest.sending")}</p>}
    </label>
  )
}

export default BlindTestUpload
