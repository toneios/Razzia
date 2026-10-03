import { createContext, useContext } from "react"
import useSound from "use-sound"

export const GameViewContext = createContext<{
  role: "player" | "control" | "projection"
  sound: boolean
  remaining?: number | null
  answers?: number
}>({ role: "player", sound: true })

export const useGameView = () => useContext(GameViewContext)

export const useGameSound: typeof useSound = (src, options) => {
  const { sound } = useGameView()

  return useSound(src, { ...options, soundEnabled: sound })
}
