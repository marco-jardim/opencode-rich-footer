/** @jsxImportSource @opentui/solid */
import type { Plugin } from "@opencode/plugin/tui"
import type { LocationRef, SessionInfo, SessionMessageInfo, TokenUsageInfo } from "@opencode/client"
import { createEffect, createMemo, createSignal, on, onCleanup, untrack } from "solid-js"
import type { FooterAction, FooterMessage, FooterSession, FooterSource, FooterTokens, Read } from "../contracts"
import { Footer } from "../footer"
import { directSiblings, siblingTarget } from "../navigation"

type Context = Plugin.Context
export interface V2Context {
  readonly location: Context["location"]
  readonly data: {
    readonly listen: Context["data"]["listen"]
    readonly session: Pick<Context["data"]["session"], "list" | "get" | "status" | "sync"> & {
      readonly message: Pick<Context["data"]["session"]["message"], "list" | "sync">
    }
    readonly location: {
      readonly default: Context["data"]["location"]["default"]
      readonly model: Pick<Context["data"]["location"]["model"], "list" | "sync">
    }
  }
  readonly client: { readonly session: Pick<Context["client"]["session"], "list"> }
  readonly keymap: Pick<Context["keymap"], "layer" | "shortcuts">
  readonly ui: { readonly router: Pick<Context["ui"]["router"], "navigate" | "current"> }
  readonly theme: {
    readonly text: Pick<Context["theme"]["text"], "base" | "muted">
    readonly background: { readonly raised: Pick<Context["theme"]["background"]["raised"], "base" | "high"> }
    readonly border: Context["theme"]["border"]
  }
}

const commands = {
  parent: "opencode-rich-footer.parent",
  previous: "opencode-rich-footer.previous",
  next: "opencode-rich-footer.next",
} as const

function finite(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined
}

export function v2Tokens(tokens: TokenUsageInfo | undefined): FooterTokens | undefined {
  if (!tokens) return undefined
  return {
    input: finite(tokens.input),
    output: finite(tokens.output),
    reasoning: finite(tokens.reasoning),
    cacheRead: finite(tokens.cache.read),
    cacheWrite: finite(tokens.cache.write),
  }
}

export function v2Session(session: SessionInfo): FooterSession {
  return {
    id: session.id,
    parentID: session.parentID,
    title: session.title,
    agent: session.agent,
    createdAt: finite(session.time.created),
  }
}

export function v2Messages(messages: readonly SessionMessageInfo[]): FooterMessage[] {
  return messages.flatMap((message): FooterMessage[] => {
    if (message.type === "compaction") return [{ type: "compaction", id: message.id, completed: message.status === "completed" }]
    if (message.type !== "assistant") return []
    return [{
      type: "assistant",
      id: message.id,
      model: { providerID: message.model.providerID, modelID: message.model.id },
      tokens: v2Tokens(message.tokens),
      cost: finite(message.cost),
      createdAt: finite(message.time.created),
      streamedAt: finite(message.time.streamed),
      completedAt: finite(message.time.completed),
    }]
  })
}

const connections = new WeakMap<object, number>()
let connectionSequence = 0

/** Construct under a Solid owner so effects, commands and listeners share its lifetime. */
export function createV2Source(context: V2Context, sessionID: Read<string>, diagnose = (message: string) => console.warn(message)): FooterSource {
  let sourceDisposed = false
  onCleanup(() => { sourceDisposed = true })
  if (!connections.has(context.client)) connections.set(context.client, ++connectionSequence)
  const connection = connections.get(context.client)
  const current = () => context.data.session.get(sessionID())
  const location = (): LocationRef => {
    const session = current()
    const fallback = context.location ?? context.data.location.default()
    return session ? { directory: session.location.directory, workspaceID: session.location.directory === fallback.directory ? fallback.workspaceID : undefined } : fallback
  }
  const key = () => JSON.stringify([connection, location().directory, location().workspaceID, sessionID()])
  const [children, setChildren] = createSignal<readonly SessionInfo[] | undefined>()
  const [childrenKey, setChildrenKey] = createSignal<string>()
  const [deleted, setDeleted] = createSignal<ReadonlySet<string>>(new Set())
  const siblings = () => {
    if (sourceDisposed) return undefined
    const session = current()
    if (!session?.parentID || childrenKey() !== key()) return undefined
    const loaded = children()
    if (!loaded) return undefined
    const merged = new Map(loaded.filter((entry) => !deleted().has(entry.id)).map((entry) => [entry.id, context.data.session.get(entry.id) ?? entry]))
    for (const entry of context.data.session.list()) {
      if (entry.parentID === session.parentID && !deleted().has(entry.id)) merged.set(entry.id, entry)
    }
    return directSiblings(v2Session(session), [...merged.values()].map(v2Session))
  }
  const active = () => {
    if (sourceDisposed) return false
    const route = context.ui.router.current()
    return route.type === "session" && route.sessionID === sessionID() && Boolean(current()) && !deleted().has(sessionID())
  }
  const target = (name: keyof typeof commands) => {
    const session = current()
    if (!active() || !session?.parentID) return undefined
    if (name === "parent") return deleted().has(session.parentID) ? undefined : context.data.session.get(session.parentID)?.id
    const candidate = siblingTarget(v2Session(session), siblings(), name === "previous" ? -1 : 1)
    return candidate?.id
  }
  const action = (name: keyof typeof commands): FooterAction => ({
    enabled: () => Boolean(target(name)),
    shortcut: () => context.keymap.shortcuts(commands[name])[0],
    run() {
      const id = target(name)
      if (id) context.ui.router.navigate({ type: "session", sessionID: id })
    },
  })
  const parent = action("parent")
  const previous = action("previous")
  const next = action("next")

  const syncIdentity = createMemo(() => JSON.stringify([key(), current()?.parentID]))
  createEffect(on(syncIdentity, () => {
    const generation = key()
    const parentID = current()?.parentID
    setChildren(undefined)
    setChildrenKey(undefined)
    setDeleted(new Set<string>())
    let disposed = false
    let refreshing = false
    let pendingRefresh = false
    const id = sessionID()
    const ref = location()
    const valid = () => !disposed && untrack(key) === generation && untrack(current)?.parentID === parentID
    const report = (scope: string, error: unknown) => {
      if (valid()) diagnose(`[opencode-rich-footer] ${scope}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const sync = (scope: string, task: () => Promise<void>) => {
      void Promise.resolve().then(() => { if (valid()) return task() }).catch((error: unknown) => report(scope, error))
    }
    const refresh = async () => {
      if (refreshing) {
        pendingRefresh = true
        return
      }
      refreshing = true
      try {
        const result: SessionInfo[] = []
        const seen = new Set<string>()
        let cursor: string | undefined
        for (let page = 0; page < 64; page++) {
          const response = await context.client.session.list({ parentID, order: "asc", cursor })
          if (!valid()) return
          result.push(...response.data.filter((entry) => entry.parentID === parentID && !deleted().has(entry.id)))
          const nextCursor = response.cursor.next ?? undefined
          if (!nextCursor) {
            setChildren(result.filter((entry) => !deleted().has(entry.id)))
            setChildrenKey(generation)
            return
          }
          if (seen.has(nextCursor)) throw new Error("Repeated child-session pagination cursor")
          seen.add(nextCursor)
          cursor = nextCursor
        }
        throw new Error("Child-session pagination exceeded 64 pages")
      } catch (error: unknown) {
        report("children sync", error)
      } finally {
        refreshing = false
        if (pendingRefresh && valid()) {
          pendingRefresh = false
          void refresh()
        }
      }
    }
    sync("session sync", () => context.data.session.sync(id))
    sync("messages sync", () => context.data.session.message.sync(id))
    sync("model catalogue sync", () => context.data.location.model.sync(ref))
    if (parentID) {
      sync("parent sync", () => context.data.session.sync(parentID))
      void refresh()
    }
    const off = context.data.listen(({ details }) => {
      if (!valid()) return
      if (!parentID) {
        if (details.type === "session.deleted" && details.data.sessionID === id) setDeleted((value) => new Set([...value, id]))
        return
      }
      if (details.type === "session.deleted") {
        const deletedID = details.data.sessionID
        const known = deletedID === id || deletedID === parentID || children()?.some((entry) => entry.id === deletedID) || context.data.session.get(deletedID)?.parentID === parentID
        // An in-flight page may contain a deleted session that is not cached yet.
        setDeleted((value) => new Set([...value, deletedID]))
        setChildren((value) => value?.filter((entry) => entry.id !== details.data.sessionID))
        if (known) void refresh()
        return
      }
      if (details.type === "session.created" && details.data.parentID === parentID) void refresh()
      if (details.type === "session.moved" && (refreshing || children()?.some((entry) => entry.id === details.data.sessionID) || context.data.session.get(details.data.sessionID)?.parentID === parentID)) void refresh()
    })
    onCleanup(() => { disposed = true; off() })
    if (!parentID) return
    context.keymap.layer(() => ({
      enabled: () => active() && Boolean(current()?.parentID),
      commands: [
        { id: commands.parent, title: "Open parent session", bind: false, palette: true, enabled: parent.enabled, run: parent.run },
        { id: commands.previous, title: "Previous sibling session", bind: false, palette: true, enabled: previous.enabled, run: previous.run },
        { id: commands.next, title: "Next sibling session", bind: false, palette: true, enabled: next.enabled, run: next.run },
      ],
    }))
  }))

  return {
    key,
    active,
    session: () => { const session = current(); return session && v2Session(session) },
    messages: () => v2Messages(context.data.session.message.list(sessionID())),
    status: () => context.data.session.status(sessionID()),
    totals: () => ({ scope: "session", tokens: v2Tokens(current()?.tokens), cost: finite(current()?.cost) }),
    siblings,
    theme: () => ({ text: context.theme.text.base, textMuted: context.theme.text.muted, border: context.theme.border.base, backgroundPanel: context.theme.background.raised.base, backgroundElement: context.theme.background.raised.high }),
    contextLimit: (model) => finite(context.data.location.model.list(location())?.find((entry) => entry.providerID === model.providerID && entry.id === model.modelID)?.limit.context),
    parent,
    previous,
    next,
    liveTokenDeltas: false,
  }
}

function V2Footer(props: { context: Context; sessionID: string }) {
  const source = createV2Source(props.context, () => props.sessionID)
  return <Footer source={source} />
}

export function setupV2(context: Context): Plugin.Cleanup {
  return context.ui.slot({ append: "session.composer.top", render: (input) => <V2Footer context={context} sessionID={input.sessionID} /> })
}
