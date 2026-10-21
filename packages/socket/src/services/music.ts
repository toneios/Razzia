import {
  listLocalMedia,
  importLocalMedia,
} from "@razzia/socket/services/media-library"

export const listMusic = () => listLocalMedia("audio").files

export const importMusic = (name: unknown) => {
  const { url } = importLocalMedia({ kind: "audio", name })

  return { url }
}
