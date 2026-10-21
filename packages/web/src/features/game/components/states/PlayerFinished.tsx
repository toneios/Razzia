import { useEffect } from "react"
import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import { usePlayerStore } from "@razzia/web/features/game/stores/player"
import { useTranslation } from "react-i18next"

interface Props {
  data: CommonStatusDataMap["FINISHED"]
}

const PlayerFinished = ({ data: { rank, subject, points } }: Props) => {
  const { player, updatePoints } = usePlayerStore()
  useEffect(() => {
    if (typeof points === "number") {
      updatePoints(points)
    }
  }, [points, updatePoints])
  const { t } = useTranslation()

  const rankKeyMap: Record<number, string> = {
    1: "game:rank.1",
    2: "game:rank.2",
    3: "game:rank.3",
  }
  const rankKey =
    typeof rank === "number" ? (rankKeyMap[rank] ?? "game:rank.other") : null

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 px-4">
      <p className="text-center text-4xl font-bold text-white drop-shadow-lg md:text-5xl">
        {subject}
      </p>

      {rank && rank <= 3 && (
        <span
          className="text-7xl"
          aria-label={t(rankKey ?? "game:rank.other", { rank })}
        >
          {["🥇", "🥈", "🥉"][rank - 1]}
        </span>
      )}
      <p className="text-center text-3xl font-bold text-white drop-shadow-lg md:text-4xl">
        {rankKey !== null ? t(rankKey, { rank }) : "—"}
      </p>

      <p className="mt-2 rounded bg-black/40 px-6 py-2 text-2xl font-bold text-white">
        {points ?? player?.points ?? 0} pts
      </p>
    </div>
  )
}

export default PlayerFinished
