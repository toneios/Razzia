import { EVENTS } from "@razzia/common/constants"
import { inviteCodeValidator } from "@razzia/common/validators/auth"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { z } from "zod"
import { getGameConfig, getQuizz } from "@razzia/socket/services/config"
import Game from "@razzia/socket/services/game"
import manager from "@razzia/socket/services/manager"
import Registry from "@razzia/socket/services/registry"
import { withGame } from "@razzia/socket/utils/game"
import { getClientId } from "@razzia/socket/utils/socket"

const projectionOpenSchema = z.object({
  password: z.string().min(1).max(4096),
  inviteCode: inviteCodeValidator,
})
const projectionJoinSchema = z.object({
  gameId: z.string().min(1).max(100),
  token: z.string().length(64),
})

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()
  const clientId = getClientId(socket)
  let projectionGameId: string | null = null

  const leaveProjection = () => {
    if (!projectionGameId) {
      return
    }

    socket.leave(projectionGameId)
    socket.leave(`projection:${projectionGameId}`)
    projectionGameId = null
  }

  socket.on(EVENTS.PROJECTION.OPEN, (payload) => {
    const parsed = projectionOpenSchema.safeParse(payload)

    if (!parsed.success) {
      socket.emit(EVENTS.PROJECTION.AUTH_ERROR, "game:projectionInvalidForm")

      return
    }

    try {
      const config = getGameConfig()

      if (
        config.managerPassword === "PASSWORD" ||
        parsed.data.password !== config.managerPassword
      ) {
        socket.emit(
          EVENTS.PROJECTION.AUTH_ERROR,
          "errors:manager.invalidPassword",
        )

        return
      }

      const game = registry.getGameByInviteCode(parsed.data.inviteCode)

      if (!game) {
        socket.emit(EVENTS.PROJECTION.AUTH_ERROR, "errors:game.notFound")

        return
      }

      socket.emit(EVENTS.PROJECTION.AUTHORIZED, {
        gameId: game.gameId,
        token: game.grantProjectionAccess(),
      })
    } catch {
      socket.emit(EVENTS.PROJECTION.AUTH_ERROR, "errors:failedToReadConfig")
    }
  })

  socket.on(EVENTS.PROJECTION.JOIN, (payload) => {
    if (
      registry.getGameByManagerSocketId(socket.id) ||
      registry.getGameByPlayerSocketId(socket.id)
    ) {
      return
    }

    leaveProjection()
    const parsed = projectionJoinSchema.safeParse(payload)
    const game = parsed.success
      ? registry.getGameById(parsed.data.gameId)
      : undefined

    if (
      !parsed.success ||
      !game ||
      !game.hasProjectionAccess(parsed.data.token)
    ) {
      socket.emit(EVENTS.PROJECTION.UNAUTHORIZED)

      return
    }

    projectionGameId = game.gameId
    game.joinProjection(socket)
  })
  socket.on(EVENTS.PROJECTION.LEAVE, leaveProjection)
  socket.on(EVENTS.MANAGER.REVEAL, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.reveal(socket)),
  )

  const handleManagerLeave = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      game.abortCooldown()
      io.to(game.gameId).emit(
        EVENTS.GAME.RESET,
        "errors:game.managerDisconnected",
      )
      registry.removeGame(game.gameId)
    }
  }

  const handlePlayerLeave = (game: Game) => {
    if (!game.started) {
      const player = game.removePlayer(socket.id)

      if (player) {
        console.log(`Player ${player.username} left game ${game.gameId}`)
      }

      return
    }

    game.setPlayerDisconnected(socket.id)
  }

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.expired")
  })

  socket.on(
    EVENTS.GAME.CREATE,
    manager.withAuth(socket, (quizzId: string) => {
      const quizzList = getQuizz()
      const quizz = quizzList.find((q) => q.id === quizzId)

      if (!quizz) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")

        return
      }

      const game = new Game(io, socket, quizz)
      registry.addGame(game)
    }),
  )

  socket.on(EVENTS.PLAYER.CHECK_PIN, (inviteCode) => {
    const game = registry.getGameByInviteCode(inviteCode)

    socket.emit(EVENTS.PLAYER.CHECK_PIN_RESULT, { valid: Boolean(game) })
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    if (game.manager.clientId === clientId) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.managerCannotJoin")

      return
    }

    if (game.players.some((p) => p.clientId === clientId)) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, game.gameId)
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username)),
  )

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.selectAnswer(socket, data.answerKeys),
    ),
  )

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard(socket)),
  )

  socket.on(EVENTS.MANAGER.LEAVE, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      console.log(`Manager left game ${game.inviteCode}`)
      handleManagerLeave(game)
    }
  })

  socket.on(EVENTS.PLAYER.LEAVE, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      handlePlayerLeave(game)
    }
  })

  socket.on("disconnect", () => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      console.log(`Manager disconnected from game ${managerGame.inviteCode}`)
      handleManagerLeave(managerGame)

      return
    }

    const playerGame = registry.getGameByPlayerSocketId(socket.id)

    if (playerGame) {
      handlePlayerLeave(playerGame)
    }
  })
}
