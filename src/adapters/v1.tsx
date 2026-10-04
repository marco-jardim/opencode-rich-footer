/** @jsxImportSource @opentui/solid */
import type { TuiPlugin } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Session } from "@opencode-ai/sdk/v2"
import type { FooterAction, FooterMessage, FooterSession, FooterSource, FooterTokens } from "../contracts"
import { Footer } from "../footer"

type TuiPluginApi = Parameters<TuiPlugin>[0]

// Keep the source testable with the exact host methods it consumes. Old v1
// hosts may lack children(), but their navigation commands still work.
export type V1SourceApi = {
  state: Pick<TuiPluginApi["state"], "provider" | "path" | "part"> & {
    session: Pick<TuiPluginApi["state"]["session"], "get" | "messages" | "status"> &
      Partial<Pick<TuiPluginApi["state"]["session"], "children">>
  }
  client: object
  theme: Pick<TuiPluginApi["theme"], "current">
  keys: Pick<TuiPluginApi["keys"], "formatBindings">
  keymap: Pick<TuiPluginApi["keymap"], "dispatchCommand">
  tuiConfig: { keybinds: Pick<TuiPluginApi["tuiConfig"]["keybinds"], "get"> }
  lifecycle: Pick<TuiPluginApi["lifecycle"], "signal">
  ui: Pick<TuiPluginApi["ui"], "toast">
}

const connections = new WeakMap<object, number>()
let nextConnection = 0

function connectionID(client: object): number {
  const existing = connections.get(client)
  if (existing !== undefined) return existing
  const id = ++nextConnection
  connections.set(client, id)
  return id
}

function validNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function sessionView(session: Session): FooterSession {
  return {
    id: session.id,
    parentID: session.parentID,
    title: session.title,
    agent: session.agent,
    createdAt: validNumber(session.time.created),
  }
}

function tokenView(tokens: AssistantMessage["tokens"]): FooterTokens {
  return {
    input: validNumber(tokens?.input),
    output: validNumber(tokens?.output),
    reasoning: validNumber(tokens?.reasoning),
    cacheRead: validNumber(tokens?.cache?.read),
    cacheWrite: validNumber(tokens?.cache?.write),
  }
}

function sum(values: readonly (number | undefined)[]): number | undefined {
  if (!values.length || values.some((value) => value === undefined)) return
  return validNumber(values.reduce<number>((total, value) => total + (value ?? 0), 0))
}

type Binding = ReturnType<V1SourceApi["tuiConfig"]["keybinds"]["get"]>[number]
type SequenceBinding = NonNullable<Parameters<V1SourceApi["keys"]["formatBindings"]>[0]>[number]

function hasSequence(binding: Binding): binding is Binding & SequenceBinding {
  // The real lookup returns compiled bindings with sequence. Its declared
  // Binding type only exposes that extension as unknown.
  return Array.isArray(binding.sequence)
}

export function createV1Source(api: V1SourceApi, sessionID: () => string): FooterSource {
  const session = () => {
    const item = api.state.session.get(sessionID())
    return item ? sessionView(item) : undefined
  }
  // The host owns the session_footer route and its lifetime.
  const active = () => !api.lifecycle.signal.aborted && Boolean(session())
  const enabled = () => active() && Boolean(session()?.parentID)

  function action(command: string): FooterAction {
    return {
      enabled,
      shortcut: () => api.keys.formatBindings(api.tuiConfig.keybinds.get(command).filter(hasSequence)),
      run() {
        if (!enabled()) return
        try {
          const result = api.keymap.dispatchCommand(command)
          if (!result.ok) {
            api.ui.toast({ variant: "warning", title: "Rich footer", message: `${command}: ${result.reason}` })
          }
        } catch (error) {
          api.ui.toast({
            variant: "error",
            title: "Rich footer",
            message: `${command}: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      },
    }
  }

  return {
    key: () => JSON.stringify([connectionID(api.client), api.state.path.directory, api.state.path.worktree, sessionID()]),
    active,
    session,
    messages() {
      const result: FooterMessage[] = []
      for (const message of api.state.session.messages(sessionID())) {
        if (message.role === "user") {
          for (const part of api.state.part(message.id)) {
            if (part.type === "compaction") result.push({ type: "compaction", id: part.id, completed: false })
          }
          continue
        }
        if (message.summary) {
          // Summary tokens describe the old history passed to the summarizer,
          // not the size of the resulting compacted context.
          result.push({
            type: "compaction",
            id: message.id,
            completed: Boolean(message.finish) && !message.error && validNumber(message.time.completed) !== undefined,
          })
          continue
        }
        result.push({
          type: "assistant",
          id: message.id,
          tokens: tokenView(message.tokens),
          model: { providerID: message.providerID, modelID: message.modelID },
          cost: validNumber(message.cost),
          createdAt: validNumber(message.time.created),
          completedAt: validNumber(message.time.completed),
        })
      }
      return result
    },
    status() {
      switch (api.state.session.status(sessionID())?.type) {
        case "idle": return "idle"
        case "busy": return "running"
        case "retry": return "retry"
        default: return undefined
      }
    },
    totals() {
      const assistants = api.state.session.messages(sessionID()).filter(
        (message): message is AssistantMessage => message.role === "assistant",
      )
      const tokens = assistants.map((message) => tokenView(message.tokens))
      return {
        scope: "loaded",
        cost: sum(assistants.map((message) => validNumber(message.cost))),
        tokens: {
          input: sum(tokens.map((item) => item.input)),
          output: sum(tokens.map((item) => item.output)),
          reasoning: sum(tokens.map((item) => item.reasoning)),
          cacheRead: sum(tokens.map((item) => item.cacheRead)),
          cacheWrite: sum(tokens.map((item) => item.cacheWrite)),
        },
      }
    },
    siblings() {
      const parentID = session()?.parentID
      if (!parentID || typeof api.state.session.children !== "function") return undefined
      return api.state.session.children(parentID).map(sessionView)
    },
    theme: () => api.theme.current,
    contextLimit(model) {
      const provider = api.state.provider.find((item) => item.id === model.providerID)
      const limit = validNumber(provider?.models[model.modelID]?.limit.context)
      return limit && limit > 0 ? limit : undefined
    },
    parent: action("session.parent"),
    previous: action("session.child.previous"),
    next: action("session.child.next"),
    // The v1 processor only publishes usage at step-finish, not token deltas.
    // It exposes no stream start timestamp, so no streamedAt is manufactured.
    liveTokenDeltas: false,
  }
}

export function installV1(api: TuiPluginApi): void {
  // Host plugin registration owns slot disposal, including plugin reloads.
  api.slots.register({
    slots: {
      session_footer(_context, props) {
        return <Footer source={createV1Source(api, () => props.session_id)} />
      },
    },
  })
}
