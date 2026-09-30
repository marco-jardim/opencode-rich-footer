import type { installV1 } from "./adapters/v1.js"
import type { setupV2 } from "./adapters/v2.js"

export const id = "opencode-rich-footer"

export function requireBun(runtime: unknown = globalThis.Bun): void {
  if (!runtime) throw new Error("opencode-rich-footer: this personal build requires the Bun TUI host (v1 or v2). Node TUI runtime identity is not supported; start the validated Bun host.")
}

export async function tui(api: Parameters<typeof installV1>[0]) {
  requireBun()
  const { installV1 } = await import("./adapters/v1.js")
  return installV1(api)
}

export async function setup(context: Parameters<typeof setupV2>[0]) {
  requireBun()
  const { setupV2 } = await import("./adapters/v2.js")
  return setupV2(context)
}

export default { id, tui, setup }
