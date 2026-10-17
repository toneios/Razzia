import MusicLibrary from "./MusicLibrary"
import BlindTestUpload from "./BlindTestUpload"
import { questionMediaValidator } from "@razzia/common/validators/quizz"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import { useQuizzEditor } from "@razzia/web/features/quizz/contexts/quizz-editor-context"
import { useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

const QuestionEditorMedia = () => {
  const { updateQuestion, currentIndex, currentQuestion } = useQuizzEditor()
  const { media } = currentQuestion
  const { t } = useTranslation()
  const [source, setSource] = useState<"library" | "upload" | "link">("library")
  const [link, setLink] = useState("")
  const [linkKind, setLinkKind] = useState<"audio" | "image" | "video">("audio")
  const chooseSource = (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("quizz:mediaPanel.source")}
      >
        {(["library", "upload", "link"] as const).map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={source === name}
            className={
              source === name
                ? "rounded-lg bg-amber-200 px-3 py-2 text-sm font-semibold text-slate-950"
                : "rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            }
            onClick={() => setSource(name)}
          >
            {t(`quizz:mediaPanel.${name}`)}
          </button>
        ))}
      </div>
      {source === "library" && <MusicLibrary />}
      {source === "upload" && <BlindTestUpload />}
      {source === "link" && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const result = questionMediaValidator.safeParse({
              type: linkKind,
              url: link,
            })

            if (!result.success) {
              toast.error(t(result.error.issues[0].message))

              return
            }

            updateQuestion(currentIndex, { media: result.data })
          }}
        >
          <select
            aria-label={t("quizz:blindTest.mediaType")}
            value={linkKind}
            onChange={(event) => {
              const { value } = event.target

              if (value === "audio" || value === "image" || value === "video") {
                setLinkKind(value)
              }
            }}
          >
            <option value="audio">Audio</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-2"
            aria-label={t("quizz:question.mediaUrlPlaceholder")}
            placeholder={t("quizz:question.mediaUrlPlaceholder")}
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <button className="rounded-lg bg-amber-200 px-3 py-2 font-semibold text-slate-950">
            {t("quizz:blindTest.useMedia")}
          </button>
        </form>
      )}
    </div>
  )

  return (
    <section className="relative z-10 rounded-2xl border border-slate-700/70 bg-slate-900/95 p-4 text-slate-100">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide">
          {t("quizz:mediaPanel.title")}
        </h2>
        {media?.type && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-red-300"
            onClick={() => updateQuestion(currentIndex, { media: undefined })}
          >
            {t("common:delete")}
          </button>
        )}
      </div>
      {media?.type ? (
        <>
          <div className="flex justify-center rounded-xl bg-slate-950/70 p-3">
            <QuestionMedia
              media={media}
              alt={currentQuestion.question}
              preview
            />
          </div>
          {(media.type === "audio" || media.type === "video") && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                {t("quizz:blindTest.startAt")}
                <input
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100"
                  type="number"
                  min="0"
                  max="86400"
                  value={media.startAt ?? 0}
                  onChange={(event) =>
                    updateQuestion(currentIndex, {
                      media: {
                        ...media,
                        startAt: Math.max(
                          0,
                          Math.min(86400, Number(event.target.value)),
                        ),
                      },
                    })
                  }
                />
              </label>
              <label className="text-xs text-slate-400">
                {t("quizz:blindTest.volume")} ·{" "}
                {Math.round((media.volume ?? 1) * 100)} %
                <input
                  className="mt-4 block w-full accent-amber-200"
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((media.volume ?? 1) * 100)}
                  onChange={(event) =>
                    updateQuestion(currentIndex, {
                      media: {
                        ...media,
                        volume: Number(event.target.value) / 100,
                      },
                    })
                  }
                />
              </label>
            </div>
          )}
          <details
            className="mt-4 border-t border-slate-700 pt-3"
            key={currentQuestion.id}
          >
            <summary className="cursor-pointer text-sm text-slate-400">
              {t("quizz:mediaPanel.replace")}
            </summary>
            <div className="pt-4">{chooseSource}</div>
          </details>
        </>
      ) : (
        chooseSource
      )}
    </section>
  )
}

export default QuestionEditorMedia
