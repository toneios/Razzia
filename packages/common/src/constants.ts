export const EVENTS = {
  MEDIA_LIBRARY: {
    LIST: "mediaLibrary:list",
    FILES: "mediaLibrary:files",
    IMPORT: "mediaLibrary:import",
    IMPORTED: "mediaLibrary:imported",
    ERROR: "mediaLibrary:error",
  },
  MUSIC: {
    LIST: "music:list",
    FILES: "music:files",
    IMPORT: "music:import",
    IMPORTED: "music:imported",
    ERROR: "music:error",
  },
  APPEARANCE: {
    GET: "appearance:get",
    DATA: "appearance:data",
    SAVE: "appearance:save",
    SAVED: "appearance:saved",
    UPLOAD: "appearance:upload",
    UPLOADED: "appearance:uploaded",
    ERROR: "appearance:error",
    CHANGED: "appearance:changed",
  },
  GAME: {
    STATUS: "game:status",
    SUCCESS_ROOM: "game:successRoom",
    SUCCESS_JOIN: "game:successJoin",
    TOTAL_PLAYERS: "game:totalPlayers",
    ERROR_MESSAGE: "game:errorMessage",
    START_COOLDOWN: "game:startCooldown",
    COOLDOWN: "game:cooldown",
    RESET: "game:reset",
    UPDATE_QUESTION: "game:updateQuestion",
    PLAYER_ANSWER: "game:playerAnswer",
    CREATE: "game:create",
  },
  PROJECTION: {
    OPEN: "projection:open",
    AUTHORIZED: "projection:authorized",
    AUTH_ERROR: "projection:authError",
    UNAUTHORIZED: "projection:unauthorized",
    JOIN: "projection:join",
    LEAVE: "projection:leave",
    SNAPSHOT: "projection:snapshot",
    PLAYERS: "projection:players",
  },
  PLAYER: {
    SUCCESS_RECONNECT: "player:successReconnect",
    UPDATE_LEADERBOARD: "player:updateLeaderboard",
    JOIN: "player:join",
    LOGIN: "player:login",
    RECONNECT: "player:reconnect",
    LEAVE: "player:leave",
    SELECTED_ANSWER: "player:selectedAnswer",
    CHECK_PIN: "player:checkPin",
    CHECK_PIN_RESULT: "player:checkPinResult",
  },
  MANAGER: {
    REVEAL_FINAL: "manager:revealFinal",
    NEXT_QUESTION_PREVIEW: "manager:nextQuestionPreview",
    SUCCESS_RECONNECT: "manager:successReconnect",
    CONFIG: "manager:config",
    GAME_CREATED: "manager:gameCreated",
    STATUS_UPDATE: "manager:statusUpdate",
    NEW_PLAYER: "manager:newPlayer",
    REMOVE_PLAYER: "manager:removePlayer",
    ERROR_MESSAGE: "manager:errorMessage",
    PLAYER_KICKED: "manager:playerKicked",
    AUTH: "manager:auth",
    RECONNECT: "manager:reconnect",
    LEAVE: "manager:leave",
    KICK_PLAYER: "manager:kickPlayer",
    START_GAME: "manager:startGame",
    ABORT_QUIZ: "manager:abortQuiz",
    NEXT_QUESTION: "manager:nextQuestion",
    SHOW_LEADERBOARD: "manager:showLeaderboard",
    REVEAL: "manager:reveal",
    GET_CONFIG: "manager:getConfig",
    LOGOUT: "manager:logout",
    UNAUTHORIZED: "manager:unauthorized",
  },
  QUIZZ: {
    GET: "quizz:get",
    DATA: "quizz:data",
    SAVE: "quizz:save",
    SAVE_SUCCESS: "quizz:saveSuccess",
    UPDATE: "quizz:update",
    UPDATE_SUCCESS: "quizz:updateSuccess",
    DELETE: "quizz:delete",
    ERROR: "quizz:error",
  },
  RESULTS: {
    GET: "results:get",
    DATA: "results:data",
    DELETE: "results:delete",
  },
} as const

export const NO_TIME_LIMIT = -1

export const MAX_POINTS = 1000

export const QUESTION_TYPES = {
  SINGLE: "single",
  MULTI: "multi",
} as const

export const SCORING_MODES = {
  STRICT: "strict",
  BALANCED: "balanced",
  LENIENT: "lenient",
} as const

export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
} as const

export const EXAMPLE_QUIZZ = {
  subject: "Example Quizz",
  questions: [
    {
      question: "What is good answer ?",
      answers: ["No", "Good answer", "No", "No"],
      solutions: [1],
      cooldown: 5,
      time: 15,
    },
    {
      question: "What is good answer with image ?",
      answers: ["No", "No", "No", "Good answer"],
      media: {
        type: MEDIA_TYPES.IMAGE,
        url: "https://placehold.co/600x400.png",
      },
      solutions: [3],
      cooldown: 5,
      time: 20,
    },
    {
      question: "What is good answer with two answers ?",
      answers: ["Good answer", "No"],
      media: {
        type: MEDIA_TYPES.IMAGE,
        url: "https://placehold.co/600x400.png",
      },
      solutions: [0],
      cooldown: 5,
      time: 20,
    },
    {
      question: "Which of these are primary colors ?",
      answers: ["Red", "Green", "Blue", "Yellow"],
      solutions: [0, 2, 3],
      cooldown: 5,
      time: 20,
    },
  ],
} as const
