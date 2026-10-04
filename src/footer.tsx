/** @jsxImportSource @opentui/solid */
import { For, Show, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { FooterAction, FooterSource, TimingSnapshot } from "./contracts"
import { deriveMetrics, formatTokens } from "./metrics"
import { FooterClock } from "./timing"

type ActionName = "parent" | "previous" | "next"
const actions: readonly ActionName[] = ["parent", "previous", "next"]
const actionLabels: Record<ActionName, string> = { parent: "Parent", previous: "Prev", next: "Next" }

function elapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return whole >= 60 ? `${Math.floor(whole / 60)}m${String(whole % 60).padStart(2, "0")}s` : `${whole}s`
}

function invoke(action: FooterAction, name: ActionName): void {
  if (!action.enabled()) return
  try {
    Promise.resolve(action.run()).catch((error: unknown) => {
      console.error(`[opencode-rich-footer] ${name} navigation failed`, error)
    })
  } catch (error: unknown) {
    console.error(`[opencode-rich-footer] ${name} navigation failed`, error)
  }
}

export function Footer(props: { source: FooterSource }) {
  const dimensions = useTerminalDimensions()
  const metrics = createMemo(() => deriveMetrics(props.source))
  const child = createMemo(() => Boolean(props.source.session()?.parentID))
  const theme = () => props.source.theme()
  const [hover, setHover] = createSignal<ActionName>()
  const [timing, setTiming] = createSignal<TimingSnapshot>({})
  const clock = new FooterClock()
  let previousKey: string | undefined

  createEffect(() => {
    const source = props.source
    const key = source.key()
    const active = source.active()
    const status = source.status()
    const last = metrics().last
    if (previousKey !== key) {
      clock.reset()
      setHover(undefined)
      previousKey = key
    }
    if (!active) {
      clock.reset()
      setTiming({})
      return
    }
    const update = () => setTiming(clock.update(key, status, last, Date.now(), source.liveTokenDeltas))
    untrack(update)
    if (status !== "running" && status !== "retry") return
    const timer = setInterval(function tickFooter() { untrack(update) }, 1000)
    onCleanup(() => clearInterval(timer))
  })
  onCleanup(() => clock.reset())

  const available = createMemo(() => Math.max(0, dimensions().width - 4))
  const wide = createMemo(() => dimensions().width >= 110)
  const narrow = createMemo(() => dimensions().width < 60)
  const navigation = createMemo(() => {
    if (!child()) return []
    const budget = narrow() ? available() : Math.max(0, Math.floor(available() / 2))
    const perAction = Math.max(1, Math.floor((budget - 4) / 3))
    return actions.map((name) => {
      const shortcut = props.source[name].shortcut()
      const label = actionLabels[name]
      const full = shortcut ? `${label} ${shortcut}` : label
      return { name, text: full.length <= perAction ? full : label, width: Math.min(perAction, full.length <= perAction ? full.length : label.length) }
    })
  })
  const navigationWidth = createMemo(() => child() ? navigation().reduce((sum, action) => sum + action.width, 0) + 4 : 0)
  const titleWidth = createMemo(() => {
    const budget = wide() ? Math.min(22, Math.floor(available() / 5)) : narrow() ? available() : available() - navigationWidth() - 2
    return Math.max(0, budget)
  })
  const title = createMemo(() => {
    const value = metrics()
    return value.position ? `${value.label} (${value.position})` : value.label
  })
  const usage = createMemo(() => {
    const value = metrics()
    const time = timing()
    const fields: string[] = []
    if (time.elapsed !== undefined) fields.push(elapsed(time.elapsed))
    if (time.tps) fields.push(`${time.tps.live ? "" : "~"}${Math.round(time.tps.value)}t/s`)
    if (value.response) {
      const response: string[] = []
      if (value.response.input !== undefined) response.push(`↑${formatTokens(value.response.input)}`)
      if (value.response.output !== undefined) response.push(`↓${formatTokens(value.response.output)}`)
      if (response.length) fields.push(`response ${response.join(" ")}`)
    }
    if (value.cost !== undefined) fields.push(`${value.scope} $${value.cost.toFixed(2)}`)
    if (value.context) {
      const context = value.context
      fields.push(`ctx ${formatTokens(context.used)}${context.limit !== undefined ? `/${formatTokens(context.limit)}` : ""}${context.percent !== undefined ? ` ${context.percent}%` : ""}`)
    }
    if (value.cachePercent !== undefined) fields.push(`cache ${value.cachePercent}%`)
    const budget = wide() ? Math.max(0, available() - titleWidth() - navigationWidth() - 4) : available()
    const selected: string[] = []
    let used = 0
    for (const field of fields) {
      const size = Array.from(field).length + (selected.length ? 3 : 0)
      if (used + size > budget) continue
      selected.push(field)
      used += size
    }
    return selected.join(" · ")
  })

  function Navigation() {
    return (
      <box flexDirection="row" gap={2} flexShrink={0} width={navigationWidth()} overflow="hidden">
        <For each={navigation()}>
          {(item) => (
            <box
              width={item.width}
              height={1}
              flexShrink={0}
              focusable={false}
              overflow="hidden"
              backgroundColor={hover() === item.name && props.source[item.name].enabled() ? theme().backgroundElement : theme().backgroundPanel}
              onMouseOver={() => setHover(item.name)}
              onMouseOut={() => setHover(undefined)}
              onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
              onMouseUp={(event) => {
                event.preventDefault()
                event.stopPropagation()
                if (event.button === 0 && !event.isDragging) invoke(props.source[item.name], item.name)
              }}
            >
              <text selectable={false} wrapMode="none" fg={props.source[item.name].enabled() ? theme().text : theme().textMuted}>
                {item.text}
              </text>
            </box>
          )}
        </For>
      </box>
    )
  }

  return (
    <Show when={props.source.active()}>
      <box
        width="100%"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        border={["left"]}
        borderColor={theme().border}
        backgroundColor={theme().backgroundPanel}
        flexShrink={0}
        overflow="hidden"
      >
        <box flexDirection={narrow() ? "column" : "row"} gap={narrow() ? 0 : 2} justifyContent="space-between" overflow="hidden">
          <box flexDirection="row" gap={2} flexGrow={1} minWidth={0} overflow="hidden">
            <text width={titleWidth()} flexShrink={0} wrapMode="none" selectable={false} fg={theme().text}>
              <b>{title()}</b>
            </text>
            <Show when={wide() && usage()}>
              <text flexGrow={1} minWidth={0} wrapMode="none" selectable={false} fg={theme().textMuted}>{usage()}</text>
            </Show>
          </box>
          <Show when={child() && !narrow()}><Navigation /></Show>
        </box>
        <Show when={!wide() && usage()}>
          <text wrapMode="none" selectable={false} fg={theme().textMuted}>{usage()}</text>
        </Show>
        <Show when={child() && narrow()}><Navigation /></Show>
      </box>
    </Show>
  )
}
