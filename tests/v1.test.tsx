/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { AssistantMessage, Message, Model, Part, Provider, Session, SessionStatus } from "@opencode-ai/sdk/v2"
import { createV1Source, type V1SourceApi } from "../src/adapters/v1"
import { Footer } from "../src/footer"

function session(id: string, parentID?: string): Session {
  return { id, parentID, slug: id, projectID: "project", directory: "D:/project", title: "@review subagent", version: "1", time: { created: 1000, updated: 2000 } }
}

function assistant(id: string, overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    id, sessionID: "child", role: "assistant", parentID: "user", agent: "review", mode: "primary",
    providerID: "first", modelID: "shared", path: { cwd: "D:/project", root: "D:/project" },
    time: { created: 1000, completed: 3000 }, cost: 0.2,
    tokens: { input: 10, output: 0, reasoning: 30, cache: { read: 20, write: 5 } },
    ...overrides,
  }
}

function model(providerID: string, context: number): Model {
  const media = { text: true, audio: false, image: false, video: false, pdf: false }
  return {
    id: "shared", providerID, name: "Shared", api: { id: "shared", url: "https://example.test", npm: "example" },
    capabilities: { temperature: false, reasoning: true, attachment: false, toolcall: true, input: media, output: media, interleaved: false },
    cost: { input: 1, output: 1, cache: { read: 1, write: 1 } }, limit: { context, output: 100 },
    status: "active", options: {}, headers: {}, release_date: "2026-01-01",
  }
}

function provider(id: string, context: number): Provider {
  return { id, name: id, source: "config", env: [], options: {}, models: { shared: model(id, context) } }
}

function fixture() {
  const controller = new AbortController()
  const sessions = new Map<string, Session>([["child", session("child", "parent")], ["parent", session("parent")]])
  let messages: readonly Message[] = [assistant("answer")]
  let status: SessionStatus | undefined = { type: "busy" }
  let children = [session("z", "parent"), session("child", "parent"), session("a", "parent")]
  let currentID = "child"
  let client: object = {}
  const parts = new Map<string, Part[]>()
  const dispatches: string[] = []
  const reads: string[] = []
  const warnings: Parameters<V1SourceApi["ui"]["toast"]>[0][] = []
  const sequence: NonNullable<Parameters<V1SourceApi["keys"]["formatBindings"]>[0]>[number]["sequence"] = [
    { stroke: { name: "p", ctrl: false, shift: false, meta: false, super: false }, display: "P" },
  ]
  const color = RGBA.fromHex("#ffffff")
  const theme: V1SourceApi["theme"]["current"] = {
    primary: color, secondary: color, accent: color, error: color, warning: color, success: color, info: color,
    text: color, textMuted: color, selectedListItemText: color, background: color, backgroundPanel: color,
    backgroundElement: color, backgroundMenu: color, border: color, borderActive: color, borderSubtle: color,
    diffAdded: color, diffRemoved: color, diffContext: color, diffHunkHeader: color, diffHighlightAdded: color,
    diffHighlightRemoved: color, diffAddedBg: color, diffRemovedBg: color, diffContextBg: color,
    diffLineNumber: color, diffAddedLineNumberBg: color, diffRemovedLineNumberBg: color,
    markdownText: color, markdownHeading: color, markdownLink: color, markdownLinkText: color,
    markdownCode: color, markdownBlockQuote: color, markdownEmph: color, markdownStrong: color,
    markdownHorizontalRule: color, markdownListItem: color, markdownListEnumeration: color,
    markdownImage: color, markdownImageText: color, markdownCodeBlock: color,
    syntaxComment: color, syntaxKeyword: color, syntaxFunction: color, syntaxVariable: color,
    syntaxString: color, syntaxNumber: color, syntaxType: color, syntaxOperator: color,
    syntaxPunctuation: color, thinkingOpacity: 0.6,
  }
  const api: V1SourceApi = {
    get client() { return client },
    state: {
      provider: [provider("first", 1000), provider("second", 2000)],
      path: { state: "state", config: "config", directory: "D:/project", worktree: "D:/project" },
      part: (id) => parts.get(id) ?? [],
      session: {
        get: (id) => sessions.get(id), messages: () => messages, status: () => status,
        children: () => children,
      },
    },
    theme: { current: theme },
    keys: { formatBindings: (bindings) => bindings?.map((binding) => binding.sequence.map((part) => part.display).join(" ")).join(" / ") || undefined },
    keymap: { dispatchCommand: (command) => { dispatches.push(`${currentID}:${command}`); return { ok: true } } },
    tuiConfig: { keybinds: { get: (command) => { reads.push(command); return [{ key: "p", sequence }] } } },
    lifecycle: { signal: controller.signal }, ui: { toast: (warning) => warnings.push(warning) },
  }
  return {
    api, sessions, parts, dispatches, reads, warnings, controller,
    source: createV1Source(api, () => currentID),
    setMessages: (value: readonly Message[]) => { messages = value },
    setStatus: (value: SessionStatus | undefined) => { status = value },
    setChildren: (value: Session[]) => { children = value },
    setSession: (value: string) => { currentID = value },
    reconnect: () => { client = {} },
  }
}

describe("v1 source", () => {
  for (const id of ["parent", "child"]) {
    test(`${id} renders metrics with navigation only for a child`, async () => {
      const f = fixture()
      f.setSession(id)
      const setup = await testRender(() => <Footer source={f.source} />, { width: 160, height: 10 })
      try {
        await setup.renderOnce()
        const frame = setup.captureCharFrame()
        for (const metric of ["response ↑35 ↓30", "loaded $0.20", "ctx 65/1k", "cache 57%", "0s"]) expect(frame).toContain(metric)
        expect(frame).not.toContain("t/s") // v1 does not expose a stream timestamp.
        for (const label of ["Parent", "Prev", "Next"]) expect(frame.includes(label)).toBe(id === "child")
        expect(f.source.active()).toBe(true)
        if (id === "parent") {
          expect(f.reads).toEqual([])
          for (const action of [f.source.parent, f.source.previous, f.source.next]) {
            expect(action.enabled()).toBe(false)
            action.run()
          }
          expect(f.dispatches).toEqual([])
        }
        f.controller.abort()
        expect(f.source.active()).toBe(false)
      } finally {
        setup.renderer.destroy()
      }
    })
  }

  test("preserves reasoning-only usage, valid zeroes, model identity and loaded scope", () => {
    const f = fixture()
    expect(f.source.messages()).toEqual([{
      type: "assistant", id: "answer", model: { providerID: "first", modelID: "shared" },
      tokens: { input: 10, output: 0, reasoning: 30, cacheRead: 20, cacheWrite: 5 },
      cost: 0.2, createdAt: 1000, completedAt: 3000,
    }])
    expect(f.source.totals()).toEqual({ scope: "loaded", cost: 0.2, tokens: { input: 10, output: 0, reasoning: 30, cacheRead: 20, cacheWrite: 5 } })
    expect(f.source.liveTokenDeltas).toBe(false)
    expect(f.source.contextLimit({ providerID: "first", modelID: "shared" })).toBe(1000)
    expect(f.source.contextLimit({ providerID: "second", modelID: "shared" })).toBe(2000)
    expect(f.source.contextLimit({ providerID: "missing", modelID: "shared" })).toBeUndefined()
    f.api.state.provider[0].models.shared.limit.context = 0
    expect(f.source.contextLimit({ providerID: "first", modelID: "shared" })).toBeUndefined()
  })

  test("unknown, invalid and empty usage remain unknown instead of zero", () => {
    const f = fixture()
    const message = assistant("invalid", { cost: Number.NaN, tokens: { input: Infinity, output: -1, reasoning: 0, cache: { read: Number.NaN, write: 0 } } })
    Reflect.deleteProperty(message.tokens, "input")
    f.setMessages([message])
    expect(f.source.totals()).toEqual({ scope: "loaded", cost: undefined, tokens: { input: undefined, output: undefined, reasoning: 0, cacheRead: undefined, cacheWrite: 0 } })
    f.setMessages([])
    expect(f.source.totals().cost).toBeUndefined()
    expect(f.source.totals().tokens?.output).toBeUndefined()
  })

  test("maps only known statuses and does not create stream timestamps", () => {
    const f = fixture()
    expect(f.source.status()).toBe("running")
    f.setStatus({ type: "retry", attempt: 1, message: "retry", next: 2000 })
    expect(f.source.status()).toBe("retry")
    f.setStatus({ type: "idle" })
    expect(f.source.status()).toBe("idle")
    f.setStatus(undefined)
    expect(f.source.status()).toBeUndefined()
    // Simulate a future host status without weakening the declared SDK types.
    Reflect.set(f.api.state.session, "status", () => ({ type: "future" }))
    expect(f.source.status()).toBeUndefined()
    expect(f.source.messages()[0]).not.toHaveProperty("streamedAt")
  })

  test("preserves host sibling order and still navigates when children is absent", () => {
    const f = fixture()
    expect(f.source.siblings()?.map((item) => item.id)).toEqual(["z", "child", "a"])
    Reflect.deleteProperty(f.api.state.session, "children")
    expect(f.source.siblings()).toBeUndefined()
    expect(f.source.previous.enabled()).toBe(true)
    f.source.previous.run()
    expect(f.dispatches).toEqual(["child:session.child.previous"])
  })

  test("reads shortcuts and current commands at click time, disables root and disposal", () => {
    const f = fixture()
    expect(f.source.parent.shortcut()).toBe("P")
    expect(f.reads).toEqual(["session.parent"])
    f.source.parent.run()
    f.source.previous.run()
    f.setSession("other")
    f.sessions.set("other", session("other", "parent"))
    f.source.next.run()
    expect(f.dispatches).toEqual(["child:session.parent", "child:session.child.previous", "other:session.child.next"])
    f.setSession("parent")
    expect(f.source.active()).toBe(true)
    expect(f.source.parent.enabled()).toBe(false)
    expect(f.source.previous.enabled()).toBe(false)
    expect(f.source.next.enabled()).toBe(false)
    f.source.parent.run()
    f.setSession("child")
    f.controller.abort()
    expect(f.source.active()).toBe(false)
    expect(f.source.next.enabled()).toBe(false)
    f.source.next.run()
    expect(f.dispatches).toHaveLength(3)
  })

  test("connection, directory and session changes invalidate the source key", () => {
    const f = fixture()
    const first = f.source.key()
    expect(f.source.key()).toBe(first)
    f.reconnect()
    const reconnected = f.source.key()
    expect(reconnected).not.toBe(first)
    f.api.state.path.directory = "D:/different"
    const moved = f.source.key()
    expect(moved).not.toBe(reconnected)
    f.setSession("parent")
    expect(f.source.key()).not.toBe(moved)
  })

  test("maps completed summaries to context boundaries and retains incomplete requests", () => {
    const f = fixture()
    const user: Message = { id: "request", sessionID: "child", role: "user", time: { created: 2000 }, agent: "build", model: { providerID: "first", modelID: "shared" } }
    f.parts.set(user.id, [{ id: "compact", messageID: user.id, sessionID: "child", type: "compaction", auto: true }])
    const summary = assistant("summary", { parentID: user.id, summary: true, finish: "stop" })
    f.setMessages([assistant("before"), user, summary, assistant("after")])
    expect(f.source.messages().map((item) => [item.type, item.id])).toEqual([
      ["assistant", "before"], ["compaction", "compact"], ["compaction", "summary"], ["assistant", "after"],
    ])
    expect(f.source.messages()[1]).toEqual({ type: "compaction", id: "compact", completed: false })
    expect(f.source.messages()[2]).toEqual({ type: "compaction", id: "summary", completed: true })
    f.setMessages([user, assistant("summary", { summary: true, finish: "stop", time: { created: 1000 }, parentID: user.id })])
    expect(f.source.messages()[1]).toEqual({ type: "compaction", id: "summary", completed: false })
    f.setMessages([user, assistant("summary", { summary: true, finish: "stop", error: { name: "UnknownError", data: { message: "failed" } }, parentID: user.id })])
    expect(f.source.messages()[1]).toEqual({ type: "compaction", id: "summary", completed: false })
  })

  test("diagnoses rejected and thrown navigation commands", () => {
    const f = fixture()
    f.api.keymap.dispatchCommand = () => ({ ok: false, reason: "disabled" })
    f.source.next.run()
    expect(f.warnings[0]?.message).toBe("session.child.next: disabled")
    f.api.keymap.dispatchCommand = () => { throw new Error("unavailable") }
    f.source.parent.run()
    expect(f.warnings[1]?.message).toBe("session.parent: unavailable")
  })
})
