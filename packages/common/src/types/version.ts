export interface VersionStatus {
  currentCommit: string | null
  latestCommit: string | null
  status: "current" | "update" | "unavailable"
  checkedAt: string
}
