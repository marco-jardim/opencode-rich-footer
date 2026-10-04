/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createRoot, createSignal, onCleanup } from "solid-js"
import type { SessionInfo, SessionMessageInfo, SessionsResponse, ModelInfo } from "@opencode/client"
import { createV2Source, v2Messages, v2Tokens, type V2Context } from "../src/adapters/v2"
import { directSiblings, siblingTarget } from "../src/navigation"
import { Footer } from "../src/footer"

const usage = { input: 100, output: 50, reasoning: 10, cache: { read: 20, write: 5 } }
function session(id: string, parentID?: string, created = 1): SessionInfo {
  return { id, parentID, projectID: "project", location: { directory: "D:/project" }, time: { created, updated: 10 - created }, tokens: usage, cost: 2 }
}
function assistant(id = "message"): Extract<SessionMessageInfo, { type: "assistant" }> {
  return { id, type: "assistant", agent: "build", model: { providerID: "provider", id: "model" }, time: { created: 10, streamed: 20, completed: 120 }, content: [] }
}
function model(providerID = "provider", limit = 64000): ModelInfo {
  return { id: "model", modelID: "provider-model-name", providerID, name: "Model", capabilities: { tools: true, input: ["text"], output: ["text"] }, variants: [], time: { released: 1 }, cost: [], status: "active", enabled: true, limit: { context: limit, output: 1000 } }
}
const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve() }
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred promise not initialized") }
  let reject: (error: Error) => void = () => { throw new Error("Deferred promise not initialized") }
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
type Event = Parameters<Parameters<V2Context["data"]["listen"]>[0]>[0]["details"]
function deletedEvent(sessionID: string): Event {
  return { id: `deleted-${sessionID}`, type: "session.deleted", created: 1, durable: { aggregateID: sessionID, seq: 1, version: 2 }, data: { sessionID } }
}
function createdEvent(sessionID: string, parentID = "parent"): Event {
  return { id: `created-${sessionID}`, type: "session.created", created: 1, durable: { aggregateID: sessionID, seq: 1, version: 1 }, data: { sessionID, parentID, projectID: "project", location: { directory: "D:/project" }, slug: sessionID, version: "2.0.20" } }
}
function movedEvent(sessionID: string): Event {
  return { id: `moved-${sessionID}`, type: "session.moved", created: 1, durable: { aggregateID: sessionID, seq: 1, version: 1 }, data: { sessionID, projectID: "project", location: { directory: "D:/moved" } } }
}

function fixture(initial: SessionInfo[] = [session("parent"), session("a", "parent"), session("b", "parent", 2)]) {
  const [sessions, setSessions] = createSignal(initial)
  const [id, setID] = createSignal(initial.find((entry) => entry.parentID)?.id ?? initial[0]?.id ?? "missing")
  const [messages, setMessages] = createSignal<SessionMessageInfo[]>([])
  const [models, setModels] = createSignal<ModelInfo[]>([])
  const listeners = new Set<Parameters<V2Context["data"]["listen"]>[0]>()
  const layers = new Set<Parameters<V2Context["keymap"]["layer"]>[0]>()
  const calls: string[] = []
  const destinations: string[] = []
  const diagnostics: string[] = []
  let list: V2Context["client"]["session"]["list"] = async (input) => ({ data: sessions().filter((entry) => entry.parentID === input?.parentID), cursor: {} })
  let sessionSync = async (sessionID: string) => { calls.push(`session:${sessionID}`) }
  let modelSync = async (directory: string) => { calls.push(`models:${directory}`) }
  let modelList: V2Context["data"]["location"]["model"]["list"] = () => models()
  const color = RGBA.fromHex("#eeeeee")
  const context: V2Context = {
    location: { directory: "D:/fallback" },
    client: { session: { list: (input, options) => { calls.push(`children:${input?.parentID}:${input?.cursor ?? ""}`); return list(input, options) } } },
    data: {
      listen(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
      session: {
        get: (sessionID) => sessions().find((entry) => entry.id === sessionID),
        list: sessions,
        status: () => "idle",
        sync: (sessionID) => sessionSync(sessionID),
        message: { list: () => messages(), sync: async (sessionID) => { calls.push(`messages:${sessionID}`) } },
      },
      location: { default: () => ({ directory: "D:/fallback" }), model: { list: (ref) => modelList(ref), sync: async (ref) => modelSync(ref?.directory ?? "") } },
    },
    ui: { router: { current: () => ({ type: "session", sessionID: id() }), navigate: (target) => { if (target.type === "session") destinations.push(target.sessionID) } } },
    keymap: {
      shortcuts: () => [],
      layer(input) { layers.add(input); onCleanup(() => { layers.delete(input) }) },
    },
    theme: { text: { base: color, muted: color }, border: { base: color }, background: { raised: { base: color, high: color } } },
  }
  let dispose = () => {}
  const source = createRoot((cleanup) => { dispose = cleanup; return createV2Source(context, id, (message) => diagnostics.push(message)) })
  return {
    source, context, calls, diagnostics, destinations, listeners, layers, dispose, setID, setSessions, setMessages, setModels,
    setList(value: typeof list) { list = value },
    emit(details: Parameters<Parameters<V2Context["data"]["listen"]>[0]>[0]["details"]) { for (const listener of listeners) listener({ details }) },
    setSessionSync(value: typeof sessionSync) { sessionSync = value },
    setModelSync(value: typeof modelSync) { modelSync = value },
    setModelList(value: typeof modelList) { modelList = value },
  }
}

describe("v2 normalization", () => {
  test("assistant tokens and cost are absent until step.ended", () => {
    const normalized = v2Messages([assistant()])[0]
    expect(normalized).toEqual({ type: "assistant", id: "message", model: { providerID: "provider", modelID: "model" }, tokens: undefined, cost: undefined, createdAt: 10, streamedAt: 20, completedAt: 120 })
  })
  test("completed compaction marks the context boundary; running and failed do not", () => {
    const running: Extract<SessionMessageInfo, { type: "compaction" }> = { id: "running", type: "compaction", status: "running", reason: "auto", summary: "", recent: "", time: { created: 1 } }
    const completed: Extract<SessionMessageInfo, { type: "compaction" }> = { ...running, id: "completed", status: "completed" }
    const failed: Extract<SessionMessageInfo, { type: "compaction" }> = { ...running, id: "failed", status: "failed", error: { type: "failed", message: "compaction failed" } }
    expect(v2Messages([assistant(), running, completed, failed])).toMatchObject([{ type: "assistant" }, { completed: false }, { completed: true }, { completed: false }])
  })
  test("nonfinite and negative values remain unknown, valid zero is preserved", () => {
    expect(v2Tokens({ input: NaN, output: Infinity, reasoning: -1, cache: { read: 0, write: -Infinity } })).toEqual({ input: undefined, output: undefined, reasoning: undefined, cacheRead: 0, cacheWrite: undefined })
    expect(v2Tokens(undefined)).toBeUndefined()
  })
})

describe("direct sibling navigation", () => {
  const root = { id: "root", createdAt: 1 }
  const a = { id: "a", parentID: "root", createdAt: 2 }
  const b = { id: "b", parentID: "root", createdAt: 2 }
  const grandchild = { id: "grandchild", parentID: "a", createdAt: 3 }
  const cousin = { id: "cousin", parentID: "other", createdAt: 1 }
  test("root has no siblings; descendants and other parents are excluded", () => {
    expect(directSiblings(root, [root, a, b])).toBeUndefined()
    expect(directSiblings(a, [cousin, grandchild, b, root, a])).toEqual([a, b])
    expect(directSiblings(grandchild, [a, b, grandchild])).toEqual([grandchild])
  })
  test("creation ties sort by ID regardless of update/list order", () => {
    expect(siblingTarget(a, [b, a], 1)).toEqual(b)
    expect(siblingTarget(b, [b, a], -1)).toEqual(a)
    expect(siblingTarget(a, [a, b], -1)).toEqual(b)
    expect(siblingTarget(b, [a, b], 1)).toEqual(a)
  })
  test("removed or missing current session cannot select a neighbor", () => {
    expect(siblingTarget(a, [b], 1)).toBeUndefined()
    expect(siblingTarget(undefined, [a, b], -1)).toBeUndefined()
    expect(siblingTarget(a, undefined, 1)).toBeUndefined()
    expect(siblingTarget(a, [], 1)).toBeUndefined()
    expect(siblingTarget(a, [a], 1)).toBeUndefined()
    expect(siblingTarget(a, [a, a], -1)).toBeUndefined()
    expect(siblingTarget(root, [a, b], 1)).toBeUndefined()
  })
  test("unknown creation dates sort before known dates and duplicate IDs count once", () => {
    const unknown = { id: "unknown", parentID: "root" }
    expect(directSiblings(a, [b, a, b, unknown])).toEqual([unknown, a, b])
    expect(siblingTarget(unknown, [b, a, unknown, b], -1)).toEqual(b)
  })
})

describe("v2 source lifecycle", () => {
  for (const id of ["parent", "a"]) {
    test(`${id} renders metrics with navigation and palette only for a child`, async () => {
      const f = fixture()
      f.setID(id)
      f.setMessages([{ ...assistant(), tokens: usage }])
      f.setModels([model()])
      f.context.data.session.status = () => "running"
      const setup = await testRender(() => <Footer source={f.source} />, { width: 160, height: 10 })
      try {
        await flush()
        await setup.renderOnce()
        const frame = setup.captureCharFrame()
        for (const metric of ["response ↑125 ↓60", "session $2.00", "ctx 185/64k", "cache 16%", "~6000t/s", "0s"]) expect(frame).toContain(metric)
        for (const label of ["Parent", "Prev", "Next"]) expect(frame.includes(label)).toBe(id === "a")
        expect(f.layers.size).toBe(id === "a" ? 1 : 0)
        expect(f.source.active()).toBe(true)
        f.emit(deletedEvent(id))
        await setup.renderOnce()
        expect(f.source.active()).toBe(false)
        expect(setup.captureCharFrame().trim()).toBe("")
      } finally {
        setup.renderer.destroy()
        f.dispose()
      }
    })
  }

  test("authoritative totals stay independent of loaded/paginated messages", async () => {
    const f = fixture()
    await flush()
    f.setMessages([{ ...assistant(), tokens: { ...usage, output: 1 }, cost: 0.01 }])
    expect(f.source.totals()).toEqual({ scope: "session", tokens: { input: 100, output: 50, reasoning: 10, cacheRead: 20, cacheWrite: 5 }, cost: 2 })
    f.setMessages([])
    expect(f.source.totals().cost).toBe(2)
    expect(f.source.liveTokenDeltas).toBe(false)
    f.dispose()
  })
  test("root syncs metrics and observes deletion without subagent sync or commands", async () => {
    const f = fixture([session("root")])
    await flush()
    expect(f.calls).toEqual(["session:root", "messages:root", "models:D:/project"])
    expect(f.listeners.size).toBe(1)
    expect(f.layers.size).toBe(0)
    expect(f.source.siblings()).toBeUndefined()
    expect(f.source.parent.enabled()).toBe(false)
    expect(f.source.previous.enabled()).toBe(false)
    expect(f.source.next.enabled()).toBe(false)
    expect(f.source.active()).toBe(true)
    f.emit(createdEvent("child", "root"))
    f.emit(movedEvent("root"))
    await flush()
    expect(f.calls).toHaveLength(3)
    f.emit(deletedEvent("root"))
    expect(f.source.active()).toBe(false)
    f.dispose()
    expect(f.listeners.size).toBe(0)
  })
  test("footer activation requires a matching session route and existing session", async () => {
    const f = fixture([session("root")])
    await flush()
    f.context.ui.router.current = () => ({ type: "home" })
    expect(f.source.active()).toBe(false)
    f.context.ui.router.current = () => ({ type: "session", sessionID: "other" })
    expect(f.source.active()).toBe(false)
    f.context.ui.router.current = () => ({ type: "session", sessionID: "root" })
    expect(f.source.active()).toBe(true)
    f.setSessions([])
    expect(f.source.active()).toBe(false)
    f.dispose()
    expect(f.source.active()).toBe(false)
  })
  test("model resolution uses provider and public model ID, and preserves unknown limits", async () => {
    const f = fixture()
    f.setModels([model("other", 1), model()])
    await flush()
    expect(f.source.contextLimit({ providerID: "provider", modelID: "model" })).toBe(64000)
    expect(f.source.contextLimit({ providerID: "missing", modelID: "model" })).toBeUndefined()
    f.setModels([model("provider", -1)])
    expect(f.source.contextLimit({ providerID: "provider", modelID: "model" })).toBeUndefined()
    f.dispose()
  })
  test("sync runs once per location/session key and uses the session directory", async () => {
    const f = fixture()
    await flush()
    expect(f.calls).toContain("models:D:/project")
    const initialCalls = f.calls.length
    f.setMessages([assistant()])
    f.setSessions([session("parent"), { ...session("a", "parent"), cost: 100 }, session("b", "parent", 2)])
    await flush()
    expect(f.calls.length).toBe(initialCalls)
    f.setSessions([session("parent"), { ...session("a", "parent"), location: { directory: "D:/moved" } }])
    await flush()
    expect(f.calls).toContain("models:D:/moved")
    expect(f.listeners.size).toBe(1)
    expect(f.layers.size).toBe(1)
    f.dispose()
  })
  test("actions and command runs revalidate after a sibling move or route change", async () => {
    const f = fixture()
    await flush()
    expect(f.source.next.enabled()).toBe(true)
    const command = [...f.layers][0]?.().commands?.find((entry) => entry.id === "opencode-rich-footer.next")
    f.setSessions([session("parent"), session("a", "parent"), session("b", "other", 2)])
    command?.run()
    expect(f.destinations).toEqual([])
    f.source.parent.run()
    expect(f.destinations).toEqual(["parent"])
    f.setID("parent")
    command?.run()
    expect(f.destinations).toEqual(["parent"])
    f.dispose()
  })
  test("pagination gives navigation and position the same complete list", async () => {
    const f = fixture([session("parent"), session("a", "parent")])
    f.setList(async (input) => input?.cursor ? { data: [session("b", "parent", 2)], cursor: {} } : { data: [session("a", "parent")], cursor: { next: "page2" } })
    f.setID("parent")
    await flush()
    f.setID("a")
    await flush()
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a", "b"])
    f.source.next.run()
    expect(f.destinations).toEqual(["b"])
    f.dispose()
  })
  test("siblings in different directories are fetched by parent without a location filter", async () => {
    const a = { ...session("a", "parent"), location: { directory: "D:/one" } }
    const b = { ...session("b", "parent", 2), location: { directory: "D:/two" } }
    const f = fixture([session("parent")])
    f.setSessions([session("parent"), a])
    f.setList(async (input) => ({ data: [a, b].filter((entry) => entry.parentID === input?.parentID && (!input?.directory || entry.location.directory === input.directory)), cursor: {} }))
    f.setID("a")
    await flush()
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a", "b"])
    f.source.previous.run()
    expect(f.destinations).toEqual(["b"])
    expect(f.calls).toContain("models:D:/one")
    f.dispose()
  })
  test("a deletion during the first pending page tombstones an uncached sibling", async () => {
    const f = fixture([session("parent")])
    const pending = deferred<SessionsResponse>()
    f.setSessions([session("parent"), session("a", "parent")])
    f.setList(() => pending.promise)
    f.setID("a")
    await flush()
    expect(f.source.siblings()).toBeUndefined()
    f.emit(deletedEvent("b"))
    pending.resolve({ data: [session("a", "parent"), session("b", "parent", 2)], cursor: {} })
    await flush()
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a"])
    expect(f.source.next.enabled()).toBe(false)
    f.source.next.run()
    expect(f.destinations).toEqual([])
    expect(f.calls.filter((call) => call.startsWith("children:")).length).toBe(1)
    f.dispose()
  })
  test("created and moved events during a pending page coalesce into one additional refresh", async () => {
    const f = fixture([session("parent")])
    const pending = deferred<SessionsResponse>()
    let requests = 0
    f.setSessions([session("parent"), session("a", "parent")])
    f.setList(() => ++requests === 1 ? pending.promise : Promise.resolve({ data: [session("a", "parent"), session("b", "parent", 2)], cursor: {} }))
    f.setID("a")
    await flush()
    f.emit(createdEvent("b"))
    f.emit(movedEvent("b"))
    f.emit(createdEvent("c"))
    f.emit(movedEvent("c"))
    expect(requests).toBe(1)
    pending.resolve({ data: [session("a", "parent")], cursor: {} })
    await flush()
    expect(requests).toBe(2)
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a", "b"])
    expect(f.diagnostics).toEqual([])
    f.dispose()
  })
  test("unrelated events do not refresh a settled sibling list", async () => {
    const f = fixture()
    await flush()
    const requests = f.calls.filter((call) => call.startsWith("children:")).length
    f.emit(createdEvent("outsider", "another-parent"))
    f.emit(movedEvent("outsider"))
    f.emit(deletedEvent("outsider"))
    await flush()
    expect(f.calls.filter((call) => call.startsWith("children:")).length).toBe(requests)
    f.dispose()
  })
  test("deletion disables stale targets even before the host cache catches up", async () => {
    const f = fixture()
    await flush()
    f.emit(deletedEvent("b"))
    await flush()
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a"])
    f.source.next.run()
    expect(f.destinations).toEqual([])
    f.emit(deletedEvent("parent"))
    f.source.parent.run()
    expect(f.destinations).toEqual([])
    f.dispose()
  })
  test("registered commands preserve editing arrows and saved runs stop after disposal", async () => {
    const f = fixture()
    await flush()
    const commands = [...f.layers][0]?.().commands ?? []
    expect(commands.map((entry) => entry.bind)).toEqual([false, false, false])
    expect(commands.every((entry) => entry.palette === true)).toBe(true)
    expect(f.source.previous.shortcut()).toBeUndefined()
    const next = commands.find((entry) => entry.id === "opencode-rich-footer.next")
    f.dispose()
    next?.run()
    expect(f.destinations).toEqual([])
  })
  test("rejections are diagnosed and cleanup removes listeners/commands", async () => {
    const f = fixture([session("parent")])
    f.setSessions([session("parent"), session("a", "parent")])
    f.setSessionSync(async () => { throw new Error("session unavailable") })
    f.setModelSync(async () => { throw new Error("catalogue unavailable") })
    f.setList(async () => { throw new Error("children unavailable") })
    f.setID("a")
    await flush()
    expect(f.diagnostics.some((value) => value.includes("session unavailable"))).toBe(true)
    expect(f.diagnostics.some((value) => value.includes("catalogue unavailable"))).toBe(true)
    expect(f.diagnostics.some((value) => value.includes("children unavailable"))).toBe(true)
    expect(f.source.siblings()).toBeUndefined()
    f.dispose()
    expect(f.listeners.size).toBe(0)
    expect(f.layers.size).toBe(0)
  })
  test("repeated pagination cursors stop without exposing a partial sibling list", async () => {
    const f = fixture([session("parent")])
    f.setSessions([session("parent"), session("a", "parent")])
    f.setList(async () => ({ data: [session("a", "parent")], cursor: { next: "same" } }))
    f.setID("a")
    await flush()
    expect(f.calls.filter((call) => call.startsWith("children:")).length).toBe(2)
    expect(f.diagnostics.some((value) => value.includes("Repeated child-session pagination cursor"))).toBe(true)
    expect(f.source.siblings()).toBeUndefined()
    f.dispose()
  })
  test("late child-sync response from an old key cannot affect the new session", async () => {
    const f = fixture([session("parent")])
    const old = deferred<SessionsResponse>()
    f.setSessions([session("parent"), session("a", "parent"), session("other"), session("c", "other")])
    f.setList(async (input) => input?.parentID === "parent" ? old.promise : { data: [session("c", "other")], cursor: {} })
    f.setID("a")
    await flush()
    f.setID("c")
    await flush()
    old.resolve({ data: [session("obsolete", "parent")], cursor: {} })
    await flush()
    expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["c"])
    expect(f.diagnostics).toEqual([])
    f.dispose()
  })
  for (const completion of ["resolve", "reject"] as const) {
    test(`late child-sync ${completion} after a location change cannot publish or diagnose`, async () => {
      const f = fixture([session("parent")])
      const old = deferred<SessionsResponse>()
      let requests = 0
      f.setSessions([session("parent"), { ...session("a", "parent"), location: { directory: "D:/one" } }])
      f.setList(() => ++requests === 1 ? old.promise : Promise.resolve({ data: [session("a", "parent"), session("new", "parent", 2)], cursor: {} }))
      f.setModelList((ref) => [model("provider", ref?.directory === "D:/one" ? 1000 : 2000)])
      f.setID("a")
      await flush()
      const oldKey = f.source.key()
      expect(f.source.contextLimit({ providerID: "provider", modelID: "model" })).toBe(1000)
      f.setSessions([session("parent"), { ...session("a", "parent"), location: { directory: "D:/two" } }])
      await flush()
      expect(f.source.key()).not.toBe(oldKey)
      expect(f.source.contextLimit({ providerID: "provider", modelID: "model" })).toBe(2000)
      if (completion === "resolve") old.resolve({ data: [session("obsolete", "parent")], cursor: {} })
      else old.reject(new Error("obsolete location"))
      await flush()
      expect(f.source.siblings()?.map((entry) => entry.id)).toEqual(["a", "new"])
      expect(f.calls).toContain("models:D:/two")
      expect(f.diagnostics).toEqual([])
      expect(f.listeners.size).toBe(1)
      expect(f.layers.size).toBe(1)
      f.dispose()
    })
  }
  test("a successful child-sync response after cleanup cannot publish or navigate", async () => {
    const f = fixture([session("parent")])
    const pending = deferred<SessionsResponse>()
    f.setSessions([session("parent"), session("a", "parent")])
    f.setList(() => pending.promise)
    f.setID("a")
    await flush()
    f.dispose()
    pending.resolve({ data: [session("a", "parent"), session("b", "parent", 2)], cursor: {} })
    await flush()
    expect(f.source.siblings()).toBeUndefined()
    f.source.next.run()
    expect(f.destinations).toEqual([])
    expect(f.diagnostics).toEqual([])
    expect(f.listeners.size).toBe(0)
    expect(f.layers.size).toBe(0)
  })
  test("late responses and rejection after cleanup cannot publish or diagnose", async () => {
    const f = fixture([session("parent")])
    const pending = deferred<SessionsResponse>()
    f.setSessions([session("parent"), session("a", "parent")])
    f.setList(() => pending.promise)
    f.setID("a")
    await flush()
    f.dispose()
    pending.reject(new Error("after cleanup"))
    await flush()
    expect(f.source.siblings()).toBeUndefined()
    expect(f.diagnostics).toEqual([])
  })
})
