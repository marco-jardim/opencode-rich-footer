/** @jsxImportSource @opentui/solid */
import type { TuiPluginModule, TuiPlugin } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message } from "@opencode-ai/sdk/v2"
import { createMemo, createSignal, createEffect, onCleanup, Show, type Accessor } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

function titlecase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s
}

const MAX_TPS_SAMPLES = 120

function useTurnTiming(
  status: Accessor<{ type: string } | undefined>,
  lastAssistant: Accessor<AssistantMessage | undefined>,
) {
  const [elapsed, setElapsed] = createSignal("")
  const [tps, setTps] = createSignal<{ value: number; live: boolean } | null>(null)
  const turnState = { ts: 0, lastTokenCount: 0, lastTokenTs: 0, tpsSamples: [] as number[] }

  createEffect(() => {
    const s = status()
    if (s && s.type !== "idle") {
      if (!turnState.ts) {
        turnState.ts = Date.now()
        turnState.lastTokenTs = Date.now()
        turnState.lastTokenCount = 0
        turnState.tpsSamples = []
      }
      const interval = setInterval(() => {
        const now = Date.now()
        const sec = Math.floor((now - turnState.ts) / 1000)
        const m = Math.floor(sec / 60)
        const ss = sec % 60
        setElapsed(m > 0 ? `${m}m${String(ss).padStart(2, "0")}s` : `${ss}s`)
        const last = lastAssistant()
        if (!last) return
        const outNow = last.tokens.output + last.tokens.reasoning
        const delta = outNow - turnState.lastTokenCount
        const deltaMs = now - turnState.lastTokenTs
        if (delta > 0 && deltaMs > 0) {
          const instant = (delta / deltaMs) * 1000
          if (turnState.tpsSamples.length >= MAX_TPS_SAMPLES) turnState.tpsSamples.shift()
          turnState.tpsSamples.push(instant)
          setTps({ value: Math.round(instant), live: true })
        }
        turnState.lastTokenCount = outNow
        turnState.lastTokenTs = now
      }, 1000)
      onCleanup(() => clearInterval(interval))
    } else {
      if (turnState.tpsSamples.length > 0) {
        const avg = turnState.tpsSamples.reduce((a, b) => a + b, 0) / turnState.tpsSamples.length
        setTps({ value: Math.round(avg), live: false })
      }
      turnState.ts = 0
      turnState.lastTokenCount = 0
      turnState.lastTokenTs = 0
      turnState.tpsSamples = []
    }
  })

  return { elapsed, tps }
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    slots: {
      session_footer(_ctx, props: { session_id: string }) {
        const sessionID = () => props.session_id

        const session = createMemo(() => api.state.session.get(sessionID()))
        const messages = createMemo<readonly Message[]>(() => api.state.session.messages(sessionID()))
        const status = createMemo(() => api.state.session.status(sessionID()))

        // Only render when this is a subagent session (has a parent)
        const isSubagent = createMemo(() => Boolean(session()?.parentID))

        const assistants = createMemo(() =>
          messages().filter((m): m is AssistantMessage => m.role === "assistant"),
        )
        const lastAssistant = createMemo(() => assistants().at(-1))

        const subagentInfo = createMemo(() => {
          const s = session()
          if (!s) return { label: "Subagent", index: 0, total: 0 }
          const agentMatch = s.title.match(/@(\w+) subagent/)
          const label = agentMatch ? titlecase(agentMatch[1]) : "Subagent"
          if (!s.parentID) return { label, index: 0, total: 0 }

          // Enumerate sibling sessions to compute position
          const totalCount = api.state.session.count()
          const siblings: typeof s[] = []
          for (let i = 0; i < totalCount; i++) {
            // api.state.session doesn't expose a direct list; fall back via best-effort
          }
          // Without a full session list API, just show "Subagent" without index.
          // (Upstream may add a sibling enumeration helper later.)
          return { label, index: 0, total: 0 }
        })

        const { elapsed: turnElapsed, tps } = useTurnTiming(status, lastAssistant)

        const usage = createMemo(() => {
          const all = assistants().filter((m) => m.tokens.output > 0)
          const last = all.at(-1)
          if (!last) return

          const tokens =
            last.tokens.input +
            last.tokens.output +
            last.tokens.reasoning +
            last.tokens.cache.read +
            last.tokens.cache.write
          if (tokens <= 0) return

          const model = api.state.provider.find((item) => item.id === last.providerID)?.models[last.modelID]
          const ctxLimit = model?.limit.context
          const pctNum = ctxLimit ? Math.min(100, Math.round((tokens / ctxLimit) * 100)) : undefined
          const cost = messages().reduce(
            (sum, item) => sum + (item.role === "assistant" ? (item as AssistantMessage).cost : 0),
            0,
          )

          const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

          const cacheRead = last.tokens.cache.read
          const turnIn = last.tokens.input + cacheRead + last.tokens.cache.write
          const turnOut = last.tokens.output + last.tokens.reasoning

          const sessionHitRate = (() => {
            const total = all.reduce(
              (s, m) => s + m.tokens.input + m.tokens.cache.read + m.tokens.cache.write,
              0,
            )
            const reads = all.reduce((s, m) => s + m.tokens.cache.read, 0)
            return total > 0 ? Math.round((reads / total) * 100) : undefined
          })()

          const ctxStr = ctxLimit
            ? `🧠${formatTokens(tokens)}/${formatTokens(ctxLimit)} (${pctNum}%)`
            : `🧠${formatTokens(tokens)}`

          return {
            context: ctxStr,
            cost: cost > 0 ? money.format(cost) : undefined,
            turn: `↑${formatTokens(turnIn)}${
              cacheRead > 0 ? ` (${formatTokens(cacheRead)} hit)` : ""
            } ↓${formatTokens(turnOut)}`,
            hitRate: sessionHitRate !== undefined ? `💾${sessionHitRate}%` : undefined,
          }
        })

        const theme = () => api.theme.current
        const [hover, setHover] = createSignal<"parent" | "prev" | "next" | null>(null)
        useTerminalDimensions()

        const shortcut = (cmd: string) =>
          api.keys.formatBindings(api.tuiConfig.keybinds.get(cmd)) ?? ""

        const dispatch = (cmd: string) => api.keymap.dispatchCommand(cmd)

        return (
          <Show when={isSubagent()}>
            <box flexShrink={0}>
              <box
                paddingTop={1}
                paddingBottom={1}
                paddingLeft={2}
                paddingRight={1}
                border={["left"]}
                borderColor={theme().border}
                flexShrink={0}
                backgroundColor={theme().backgroundPanel}
              >
                <box flexDirection="row" justifyContent="space-between" gap={1}>
                  <box flexDirection="row" gap={1}>
                    <text fg={theme().text}>
                      <b>{subagentInfo().label}</b>
                    </text>
                    <Show when={subagentInfo().total > 0}>
                      <text style={{ fg: theme().textMuted }}>
                        ({subagentInfo().index} of {subagentInfo().total})
                      </text>
                    </Show>
                    <Show when={usage()}>
                      {(item) => (
                        <text fg={theme().textMuted} wrapMode="none">
                          {[
                            turnElapsed() || undefined,
                            tps() ? `${tps()!.live ? "⚡" : "≈"}${tps()!.value}t/s` : undefined,
                            item().turn,
                            item().hitRate,
                            item().context,
                            item().cost,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </text>
                      )}
                    </Show>
                  </box>
                  <box flexDirection="row" gap={2}>
                    <box
                      onMouseOver={() => setHover("parent")}
                      onMouseOut={() => setHover(null)}
                      onMouseUp={() => dispatch("session.parent")}
                      backgroundColor={hover() === "parent" ? theme().backgroundElement : theme().backgroundPanel}
                    >
                      <text fg={theme().text}>
                        Parent <span style={{ fg: theme().textMuted }}>{shortcut("session.parent")}</span>
                      </text>
                    </box>
                    <box
                      onMouseOver={() => setHover("prev")}
                      onMouseOut={() => setHover(null)}
                      onMouseUp={() => dispatch("session.child.previous")}
                      backgroundColor={hover() === "prev" ? theme().backgroundElement : theme().backgroundPanel}
                    >
                      <text fg={theme().text}>
                        Prev <span style={{ fg: theme().textMuted }}>{shortcut("session.child.previous")}</span>
                      </text>
                    </box>
                    <box
                      onMouseOver={() => setHover("next")}
                      onMouseOut={() => setHover(null)}
                      onMouseUp={() => dispatch("session.child.next")}
                      backgroundColor={hover() === "next" ? theme().backgroundElement : theme().backgroundPanel}
                    >
                      <text fg={theme().text}>
                        Next <span style={{ fg: theme().textMuted }}>{shortcut("session.child.next")}</span>
                      </text>
                    </box>
                  </box>
                </box>
              </box>
            </box>
          </Show>
        )
      },
    },
  })
}

const plugin: TuiPluginModule = { id: "opencode-rich-footer", tui }
export default plugin
export { tui }
