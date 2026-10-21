import esbuild from "esbuild"
import { execFileSync } from "node:child_process"

let buildCommit = ""

try {
  // This JS build script is outside the socket TypeScript project.
  /* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access */
  buildCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
  /* oxlint-enable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access */
} catch {
  // Source archives without Git metadata can report an unknown version.
}

export const config = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.cjs",
  sourcemap: true,
  define: {
    "process.env.RAZZIA_BUILD_COMMIT": JSON.stringify(buildCommit),
    "process.env.NODE_ENV": '"production"',
  },
}

void esbuild.build(config)
