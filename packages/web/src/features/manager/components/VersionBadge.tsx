import { EVENTS } from "@razzia/common/constants"
import type { VersionStatus } from "@razzia/common/types/version"
import {
  useEvent,
  useSocket,
} from "@razzia/web/features/game/contexts/socket-context"
import { useEffect, useState } from "react"

export default function VersionBadge() {
  const { socket, isConnected } = useSocket()
  const [version, setVersion] = useState<VersionStatus | null>(null)

  useEvent(EVENTS.MANAGER.VERSION, setVersion)

  useEffect(() => {
    if (!isConnected) {
      setVersion(null)

      return
    }

    const check = () => socket.emit(EVENTS.MANAGER.GET_VERSION)
    check()
    const timer = window.setInterval(check, 60_000)

    return () => window.clearInterval(timer)
  }, [socket, isConnected])

  const current = version?.currentCommit?.slice(0, 7) ?? "inconnue"
  let label = "Vérification…"
  let color = "text-slate-400"
  let detail = "Impossible de confirmer la dernière version pour le moment."

  if (!isConnected) {
    label = "Hors connexion"
  } else if (version?.status === "current") {
    label = "À jour"
    color = "text-white"
    detail = "Le serveur utilise la dernière version de la branche AS Event."
  } else if (version?.status === "update") {
    label = "Mise à jour disponible"
    color = "text-orange-400"
    detail = `Version disponible : ${version.latestCommit?.slice(0, 7)}. Dans la console du serveur, entre deux parties : razzia-update --activate.`
  } else if (version) {
    label = "Vérification indisponible"
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-2 rounded-md bg-slate-950 px-2.5 py-1 text-xs ${color}`}
      title={`${detail} Vérification automatique, délai maximum habituel de 5 minutes.`}
      role="status"
      aria-live="polite"
    >
      <span>Version {current}</span>
      <span aria-hidden="true">·</span>
      <span>{label}</span>
    </span>
  )
}
