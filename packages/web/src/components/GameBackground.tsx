import { getBranding } from "@razzia/web/branding"

const GameBackground = () => {
  const background = getBranding()?.background

  return (
    <div
      aria-hidden="true"
      className="as-event-backdrop pointer-events-none fixed inset-0"
    >
      {background && (
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          src={background}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none"
          }}
        />
      )}
      <div className="as-event-beam as-event-beam-left" />
      <div className="as-event-beam as-event-beam-right" />
      <div className="as-event-stage" />
    </div>
  )
}

export default GameBackground
