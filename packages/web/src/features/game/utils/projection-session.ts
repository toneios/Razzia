const prefix = "projection-access:"

export const saveProjectionToken = (gameId: string, token: string) => {
  sessionStorage.setItem(`${prefix}${gameId}`, token)
}

export const getProjectionToken = (gameId: string): string => {
  try {
    return sessionStorage.getItem(`${prefix}${gameId}`) ?? ""
  } catch {
    return ""
  }
}

export const clearProjectionToken = (gameId: string) => {
  try {
    sessionStorage.removeItem(`${prefix}${gameId}`)
  } catch {
    // Browsers may disable session storage.
  }
}
