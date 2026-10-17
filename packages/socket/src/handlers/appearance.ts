import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  getAppearance,
  saveAppearance,
  uploadAppearanceMedia,
} from "@razzia/socket/services/appearance"
import manager from "@razzia/socket/services/manager"

export const appearanceSocketHandlers = ({ io, socket }: SocketContext) => {
  socket.on(
    EVENTS.APPEARANCE.GET,
    manager.withAuth(socket, () => {
      try {
        socket.emit(EVENTS.APPEARANCE.DATA, getAppearance())
      } catch {
        socket.emit(EVENTS.APPEARANCE.ERROR, "manager:appearance.readError")
      }
    }),
  )
  socket.on(
    EVENTS.APPEARANCE.SAVE,
    manager.withAuth(socket, (data) => {
      try {
        saveAppearance(data)
        socket.emit(EVENTS.APPEARANCE.SAVED)
        io.emit(EVENTS.APPEARANCE.CHANGED)
      } catch {
        socket.emit(EVENTS.APPEARANCE.ERROR, "manager:appearance.saveError")
      }
    }),
  )
  socket.on(
    EVENTS.APPEARANCE.UPLOAD,
    manager.withAuth(socket, (data) => {
      try {
        socket.emit(EVENTS.APPEARANCE.UPLOADED, uploadAppearanceMedia(data))
      } catch {
        socket.emit(EVENTS.APPEARANCE.ERROR, "manager:appearance.uploadError")
      }
    }),
  )
}
