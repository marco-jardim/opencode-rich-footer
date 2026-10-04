import type { RGBA } from "@opentui/core"

export type Read<T> = () => T
export interface FooterSession {
  id: string
  parentID?: string
  title?: string
  agent?: string
  createdAt?: number
}
export interface FooterModel { providerID: string; modelID: string }
export interface FooterTokens {
  input?: number
  output?: number
  reasoning?: number
  cacheRead?: number
  cacheWrite?: number
}
export interface FooterAssistant {
  type: "assistant"
  id: string
  tokens?: FooterTokens
  model?: FooterModel
  cost?: number
  createdAt?: number
  streamedAt?: number
  completedAt?: number
}
export type FooterMessage = FooterAssistant | { type: "compaction"; id: string; completed: boolean }
export interface FooterTotals { tokens?: FooterTokens; cost?: number; scope: "session" | "loaded" }
export interface FooterTheme {
  text: string | RGBA
  textMuted: string | RGBA
  border: string | RGBA
  backgroundPanel: string | RGBA
  backgroundElement: string | RGBA
}
export interface FooterAction {
  enabled: Read<boolean>
  shortcut: Read<string | undefined>
  run(): void | Promise<void>
}
export type FooterStatus = "idle" | "running" | "retry" | undefined
export interface FooterSource {
  key: Read<string>
  session: Read<FooterSession | undefined>
  messages: Read<readonly FooterMessage[]>
  status: Read<FooterStatus>
  totals: Read<FooterTotals>
  siblings: Read<readonly FooterSession[] | undefined>
  theme: Read<FooterTheme>
  contextLimit(model: FooterModel): number | undefined
  parent: FooterAction
  previous: FooterAction
  next: FooterAction
  liveTokenDeltas: boolean
}

export interface FooterMetrics {
  label: string
  position?: string
  response?: { input?: number; output?: number; cacheRead?: number }
  context?: { used: number; limit?: number; percent?: number }
  cachePercent?: number
  cost?: number
  scope: "session" | "loaded"
  last?: FooterAssistant
}
export interface TimingSnapshot {
  elapsed?: number
  tps?: { value: number; live: boolean }
}
