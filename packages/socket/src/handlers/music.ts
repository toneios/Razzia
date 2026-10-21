import {
  listLocalMedia,
  importLocalMedia,
} from "@razzia/socket/services/media-library"
import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { importMusic, listMusic } from "@razzia/socket/services/music"
import manager from "@razzia/socket/services/manager"

export const musicSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.MEDIA_LIBRARY.LIST,
    manager.withAuth(socket, (kind) => {
      try {
        socket.emit(EVENTS.MEDIA_LIBRARY.FILES, listLocalMedia(kind))
      } catch {
        socket.emit(EVENTS.MEDIA_LIBRARY.ERROR, "quizz:blindTest.mediaError")
      }
    }),
  )
  socket.on(
    EVENTS.MEDIA_LIBRARY.IMPORT,
    manager.withAuth(socket, (data) => {
      try {
        socket.emit(EVENTS.MEDIA_LIBRARY.IMPORTED, importLocalMedia(data))
      } catch {
        socket.emit(EVENTS.MEDIA_LIBRARY.ERROR, "quizz:blindTest.mediaError")
      }
    }),
  )
  socket.on(
    EVENTS.MUSIC.LIST,
    manager.withAuth(socket, () => {
      try {
        socket.emit(EVENTS.MUSIC.FILES, listMusic())
      } catch {
        socket.emit(EVENTS.MUSIC.ERROR, "quizz:blindTest.folderError")
      }
    }),
  )
  socket.on(
    EVENTS.MUSIC.IMPORT,
    manager.withAuth(socket, (name) => {
      try {
        socket.emit(EVENTS.MUSIC.IMPORTED, importMusic(name))
      } catch {
        socket.emit(EVENTS.MUSIC.ERROR, "quizz:blindTest.folderError")
      }
    }),
  )
}
