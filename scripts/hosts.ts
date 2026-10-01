import path from "node:path"
import { fileURLToPath } from "node:url"

export const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
export const hosts = {
  v1: {
    root: process.env.RICH_FOOTER_V1_HOST ?? "D:/git/opencode",
    runtime: "packages/opencode",
    bun: process.env.RICH_FOOTER_V1_BUN ?? "C:/Users/Marquinho/.bun/bin/bun.exe",
  },
  v2: {
    root: process.env.RICH_FOOTER_V2_HOST ?? "D:/git/opencode-rich-footer-host-v2",
    runtime: "packages/tui",
    bun: process.env.RICH_FOOTER_V2_BUN ?? "C:/Users/Marquinho/.bun/versions/1.4.2/bun.exe",
  },
}

export function dependencies(generation: keyof typeof hosts) {
  const host = hosts[generation]
  return path.join(host.root, host.runtime, "node_modules")
}
