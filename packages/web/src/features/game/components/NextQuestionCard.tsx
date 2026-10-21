import type { NextQuestionPreview } from "@razzia/common/types/game/socket"
import { useTranslation } from "react-i18next"

const NextQuestionCard = ({ data }: { data: NextQuestionPreview }) => {
  const { t } = useTranslation()

  return (
    <aside className="relative z-10 mx-4 mb-4 flex max-h-[75dvh] shrink-0 flex-col gap-3 self-stretch overflow-y-auto rounded-2xl border border-amber-200/25 bg-slate-950 p-5 text-white xl:ml-0 xl:w-80 xl:self-start">
      <p className="text-xs font-semibold tracking-wider text-amber-200">
        {t("game:nextPreview.private")}
      </p>
      <h2 className="text-lg font-bold">
        {t("game:nextPreview.title", {
          number: data.number,
          total: data.total,
        })}
      </h2>
      <p className="text-xl font-semibold">{data.question}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        {data.mediaType && (
          <span className="rounded-full bg-slate-800 px-3 py-1">
            {t(`game:nextPreview.${data.mediaType}`)}
          </span>
        )}
        <span className="rounded-full bg-slate-800 px-3 py-1">
          {data.time < 0
            ? t("game:nextPreview.noTimer")
            : t("game:nextPreview.time", { count: data.time })}
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {data.answers.map((answer, index) => (
          <li
            key={index}
            className={
              data.solutions.includes(index)
                ? "rounded-lg border border-emerald-400/40 bg-emerald-950 p-3 text-sm text-emerald-100"
                : "rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300"
            }
          >
            <span className="mr-2 font-bold">
              {String.fromCharCode(65 + index)}.
            </span>
            {answer}
            {data.solutions.includes(index) && (
              <span className="mt-1 block text-xs font-semibold text-emerald-300">
                {t("game:nextPreview.correct")}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="text-xs leading-relaxed text-slate-400">
        {t("game:nextPreview.hint")}
      </p>
    </aside>
  )
}

export default NextQuestionCard
