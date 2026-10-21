import type { CommonStatusDataMap } from "@razzia/common/types/game/status"
import QuestionMedia from "@razzia/web/components/QuestionMedia"
import Answers from "./Answers"
import Question from "./Question"

interface Props {
  data:
    | CommonStatusDataMap["SHOW_QUESTION"]
    | CommonStatusDataMap["SELECT_ANSWER"]
}

// Both statuses use this component so playback survives the arrival of choices.
const QuestionStage = ({ data }: Props) => (
  <div className="flex w-full flex-1 flex-col">
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-5 px-4 py-6">
      <h2 className="text-center text-2xl font-bold text-white drop-shadow-lg md:text-4xl lg:text-5xl">
        {data.question}
      </h2>
      <QuestionMedia media={data.media} alt={data.question} />
    </div>
    {"answers" in data ? (
      <Answers data={data} hideIntro />
    ) : (
      <Question data={data} hideIntro />
    )}
  </div>
)

export default QuestionStage
