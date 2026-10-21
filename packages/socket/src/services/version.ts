import type { VersionStatus } from "@razzia/common/types/version"
import { execFileSync } from "node:child_process"

const COMMIT = /^[0-9a-f]{40}$/u
const REPOSITORY = "toneios/Razzia"
const BRANCH = "as-event/three-interfaces"

export function installedCommit(): string | null {
  const stamped = process.env.RAZZIA_BUILD_COMMIT

  if (stamped && COMMIT.test(stamped)) {
    return stamped
  }

  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()

    return COMMIT.test(commit) ? commit : null
  } catch {
    return null
  }
}

export async function fetchLatestCommit(
  request: typeof fetch = fetch,
): Promise<string> {
  const response = await request(
    `https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(BRANCH)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Razzia-AS-Event",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    },
  )

  if (!response.ok) {
    throw new Error("GitHub version check unavailable")
  }

  const body: unknown = await response.json()

  if (
    typeof body !== "object" ||
    body === null ||
    !("sha" in body) ||
    typeof body.sha !== "string" ||
    !COMMIT.test(body.sha)
  ) {
    throw new Error("Invalid GitHub commit")
  }

  return body.sha
}

// One cache and one in-flight request per server, shared by all manager tabs.
export function createVersionChecker({
  currentCommit,
  fetchLatest,
  now = Date.now,
}: {
  currentCommit: string | null
  fetchLatest: () => Promise<string>
  now?: () => number
}): () => Promise<VersionStatus> {
  let cached: VersionStatus | null = null
  let expiresAt = 0
  let pending: Promise<VersionStatus> | null = null

  return () => {
    if (cached && now() < expiresAt) {
      return Promise.resolve(cached)
    }

    if (pending) {
      return pending
    }

    pending = (async (): Promise<VersionStatus> => {
      let latestCommit: string | null = null

      try {
        if (!currentCommit || !COMMIT.test(currentCommit)) {
          throw new Error("Installed commit unknown")
        }

        latestCommit = await fetchLatest()

        if (!COMMIT.test(latestCommit)) {
          throw new Error("Invalid latest commit")
        }

        cached = {
          currentCommit,
          latestCommit,
          status: currentCommit === latestCommit ? "current" : "update",
          checkedAt: new Date(now()).toISOString(),
        }
        expiresAt = now() + 5 * 60_000
      } catch {
        cached = {
          currentCommit,
          latestCommit: null,
          status: "unavailable",
          checkedAt: new Date(now()).toISOString(),
        }
        expiresAt = now() + 60_000
      }

      return cached
    })().finally(() => {
      pending = null
    })

    return pending
  }
}

// Snapshot once: pulling source files must not change the running version.
export const getVersionStatus = createVersionChecker({
  currentCommit: installedCommit(),
  fetchLatest: fetchLatestCommit,
})
