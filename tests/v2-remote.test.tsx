/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { LocationRef, ModelInfo, OpenCode, SessionInfo, SessionMessageInfo } from "@opencode/client"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal, onCleanup } from "solid-js"
import { createV2Source, type V2Context } from "../src/adapters/v2"
import type { FooterSource, FooterStatus } from "../src/contracts"
import { Footer } from "../src/footer"

const host = process.env.RICH_FOOTER_HOST
if (!host) throw new Error("RICH_FOOTER_HOST must point to the v2 host checkout")
const remoteClient: { make: typeof OpenCode.make } = await import(pathToFileURL(join(host, "packages/client/src/promise/client.ts")).href)

function model(limit: number): ModelInfo {
  return {
    id: "model", modelID: "provider-model-name", providerID: "provider", name: "Model",
    capabilities: { tools: true, input: ["text"], output: ["text"] }, variants: [],
    time: { released: 1 }, cost: [], status: "active", enabled: true,
    limit: { context: limit, output: 1000 },
  }
}

function session(id: string, directory: string, created: number, parentID?: string): SessionInfo {
  return {
    id, parentID, projectID: "project", title: id, agent: "build", location: { directory },
    time: { created, updated: created }, cost: 0,
    tokens: { input: 2000, output: 1000, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

function locationKey(ref: LocationRef): string {
  return JSON.stringify([ref.directory, ref.workspaceID])
}

async function setup(failInitially = false, latency = 0) {
  const parent = session("parent", "D:/remote-parent", 0)
  const siblings = [session("a", "D:/remote-a", 1, parent.id), session("b", "D:/remote-b", 2, parent.id), session("c", "D:/remote-c", 3, parent.id)]
  const local = { directory: "D:/local-client" }
  const remote = { directory: "D:/remote-b" }
  const requests: { method: string; url: URL; status: number }[] = []
  const failures = { children: failInitially, models: failInitially }
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      if (latency) await Bun.sleep(latency)
      const url = new URL(request.url)
      const entry = { method: request.method, url, status: 200 }
      requests.push(entry)
      const json = (data: unknown, status = 200) => { entry.status = status; return Response.json(data, { status }) }
      if (url.pathname === "/api/session") {
        if (failures.children) return json({ error: "controlled children outage" }, 503)
        if (url.searchParams.get("parentID") !== parent.id) return json({ error: "wrong parent" }, 400)
        return url.searchParams.get("cursor") === "second-page"
          ? json({ data: [siblings[2]], cursor: {} })
          : json({ data: siblings.slice(0, 2), cursor: { next: "second-page" } })
      }
      if (url.pathname === "/api/model") {
        // 500 is intentionally outside declared errors, so the real client must
        // produce its UnexpectedStatus error rather than accept an empty list.
        if (failures.models) return json({ error: "controlled model outage" }, 500)
        const directory = url.searchParams.get("location[directory]")
        if (!directory) return json({ error: "missing model location" }, 400)
        return json({ location: { directory }, data: [model(directory === remote.directory ? 64000 : 32000)] })
      }
      return json({ error: "unexpected endpoint" }, 404)
    },
  })
  const client = remoteClient.make({ baseUrl: server.url.toString() })
  const [catalogues, setCatalogues] = createSignal<ReadonlyMap<string, ModelInfo[]>>(new Map([[locationKey(local), [model(32000)]]]))
  const [status, setStatus] = createSignal<FooterStatus>("idle")
  const now = Date.now()
  const messages: SessionMessageInfo[] = [{
    id: "answer", type: "assistant", agent: "build", model: { providerID: "provider", id: "model" },
    time: { created: now - 2000, streamed: now - 1000, completed: now },
    tokens: siblings[1].tokens, cost: 0, content: [],
  }]
  const listeners = new Set<Parameters<V2Context["data"]["listen"]>[0]>()
  const layers = new Set<Parameters<V2Context["keymap"]["layer"]>[0]>()
  const diagnostics: string[] = []
  const destinations: string[] = []
  const context: V2Context = {
    location: local,
    client,
    data: {
      listen(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
      session: {
        // The host cache has only the parent and current child. Other siblings
        // must come from real HTTP pagination, including their directories.
        list: () => [parent, siblings[1]],
        get: (id) => [parent, siblings[1]].find((entry) => entry.id === id),
        status: () => status() === "running" ? "running" : "idle",
        sync: async () => undefined,
        message: { list: () => messages, sync: async () => undefined },
      },
      location: {
        default: () => local,
        model: {
          list: (ref) => catalogues().get(locationKey(ref ?? local)),
          async sync(ref) {
            const location = ref ?? local
            const response = await client.model.list({ location })
            setCatalogues((current) => new Map(current).set(locationKey(location), response.data))
          },
        },
      },
    },
    ui: { router: { current: () => ({ type: "session", sessionID: "b" }), navigate(destination) { if (destination.type === "session") destinations.push(destination.sessionID) } } },
    keymap: { shortcuts: () => [], layer(input) { layers.add(input); onCleanup(() => { layers.delete(input) }) } },
    theme: {
      text: { base: RGBA.fromHex("#ffffff"), muted: RGBA.fromHex("#888888") },
      background: { raised: { base: RGBA.fromHex("#111111"), high: RGBA.fromHex("#333333") } },
      border: { base: RGBA.fromHex("#444444") },
    },
  }
  const intervals = spyOn(globalThis, "setInterval")
  const clears = spyOn(globalThis, "clearInterval")
  let source: FooterSource | undefined
  function RemoteFooter() {
    source = createV2Source(context, () => "b", (message) => diagnostics.push(message))
    return <Footer source={source} />
  }
  let app: Awaited<ReturnType<typeof testRender>>
  try {
    app = await testRender(() => <RemoteFooter />, { width: 120, height: 10 })
  } catch (error: unknown) {
    intervals.mockRestore()
    clears.mockRestore()
    await server.stop(true)
    throw error
  }
  return {
    app, server, client, requests, failures, context, remote, local, listeners, layers, diagnostics, destinations, setStatus,
    source() { if (!source) throw new Error("Remote footer did not mount"); return source },
    async waitForData(predicate: () => boolean) {
      // Renderer waitFor stops as soon as rendering is idle, even while a real
      // HTTP response is pending. Yield to I/O independently of frame scheduling.
      const deadline = performance.now() + 5000
      while (!predicate()) {
        if (performance.now() >= deadline) throw new Error(`Timed out waiting for HTTP data: ${JSON.stringify({ requests: requests.map(({ url, status }) => ({ url: url.href, status })), diagnostics })}`)
        await Bun.sleep(5)
      }
    },
    emitRefresh() {
      for (const listener of listeners) listener({ details: {
        id: "created-c", type: "session.created", created: 1,
        durable: { aggregateID: "c", seq: 1, version: 1 },
        data: { sessionID: "c", parentID: "parent", projectID: "project", location: { directory: "D:/remote-c" }, slug: "c", version: "2.0.20" },
      } })
    },
    async dispose() {
      try {
        app.renderer.destroy()
        expect(listeners.size).toBe(0)
        expect(layers.size).toBe(0)
        intervals.mock.calls.forEach(([callback], index) => {
          const result = intervals.mock.results[index]
          if (typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return") {
            expect(clears.mock.calls.map(([handle]) => handle)).toContain(result.value)
          }
        })
        expect(source?.next.enabled()).toBe(false)
      } finally {
        intervals.mockRestore()
        clears.mockRestore()
        await server.stop(true)
      }
      expect(server.pendingRequests).toBe(0)
      await expect(fetch(server.url)).rejects.toBeDefined()
    },
  }
}

test.each([0, 100])("real v2 HTTP client paginates cross-directory siblings and renders the remote model limit (%i ms HTTP latency)", async (latency) => {
  const fixture = await setup(false, latency)
  try {
    await fixture.waitForData(() => fixture.source().siblings()?.length === 3 && fixture.source().contextLimit({ providerID: "provider", modelID: "model" }) === 64000)
    await fixture.app.renderOnce()
    const childrenRequests = fixture.requests.filter((entry) => entry.url.pathname === "/api/session")
    expect(childrenRequests).toHaveLength(2)
    expect(childrenRequests.map((entry) => entry.url.searchParams.get("cursor"))).toEqual([null, "second-page"])
    for (const request of childrenRequests) {
      expect(request.method).toBe("GET")
      expect(request.url.searchParams.get("parentID")).toBe("parent")
      expect(request.url.searchParams.get("order")).toBe("asc")
      expect(request.url.searchParams.has("directory")).toBe(false)
      expect(request.url.searchParams.has("location[directory]")).toBe(false)
      expect(request.status).toBe(200)
    }
    expect(fixture.source().siblings()?.map((entry) => entry.id)).toEqual(["a", "b", "c"])
    const catalogue = fixture.requests.filter((entry) => entry.url.pathname === "/api/model")
    expect(catalogue).toHaveLength(1)
    expect(catalogue[0].url.searchParams.get("location[directory]")).toBe(fixture.remote.directory)
    expect(fixture.context.data.location.model.list(fixture.local)?.[0].limit.context).toBe(32000)
    expect(fixture.context.data.location.model.list(fixture.remote)?.[0].limit.context).toBe(64000)
    expect(fixture.app.captureCharFrame()).toContain("(2 of 3)")
    expect(fixture.app.captureCharFrame()).toContain("ctx 3k/64k 5%")
    expect(fixture.app.captureCharFrame()).not.toContain("/32k")
    fixture.source().previous.run()
    fixture.source().next.run()
    expect(fixture.destinations).toEqual(["a", "c"])
    expect(fixture.diagnostics).toEqual([])
    fixture.setStatus("running")
    await fixture.app.renderOnce()
  } finally {
    await fixture.dispose()
  }
})

test.each([0, 100])("real HTTP failures are diagnosed, preserve unknown state and recover from a fresh sync (%i ms HTTP latency)", async (latency) => {
  const fixture = await setup(true, latency)
  try {
    await fixture.waitForData(() => fixture.diagnostics.some((entry) => entry.includes("children sync")) && fixture.diagnostics.some((entry) => entry.includes("model catalogue sync")))
    await fixture.app.renderOnce()
    expect(fixture.requests.filter((entry) => entry.status >= 500).map((entry) => entry.status).sort()).toEqual([500, 503])
    expect(fixture.source().siblings()).toBeUndefined()
    expect(fixture.source().next.enabled()).toBe(false)
    expect(fixture.source().contextLimit({ providerID: "provider", modelID: "model" })).toBeUndefined()
    expect(fixture.app.captureCharFrame()).not.toContain("/32k")
    expect(fixture.app.captureCharFrame()).not.toContain("/64k")
    const errors = fixture.diagnostics.length
    fixture.failures.children = false
    fixture.failures.models = false
    fixture.emitRefresh()
    await fixture.context.data.location.model.sync(fixture.remote)
    await fixture.waitForData(() => fixture.source().siblings()?.length === 3)
    await fixture.app.renderOnce()
    expect(fixture.app.captureCharFrame()).toContain("ctx 3k/64k 5%")
    expect(fixture.source().next.enabled()).toBe(true)
    fixture.source().next.run()
    expect(fixture.destinations).toEqual(["c"])
    expect(fixture.diagnostics).toHaveLength(errors)
  } finally {
    await fixture.dispose()
  }
})
