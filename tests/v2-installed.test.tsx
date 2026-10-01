/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { access, cp, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { RGBA } from "@opentui/core"
import { createComponent, testRender, type JSX } from "@opentui/solid"
import { createComponent as createSolidComponent, createMemo, createSignal, For, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { Plugin } from "@opencode/plugin/tui"
import type { SessionInfo, SessionMessageInfo } from "@opencode/client"
import type { V2Context } from "../src/adapters/v2"

type Claim = { key: string; plugin: string; placement: { kind: "append"; target: string }; render: (input: { readonly sessionID: string }) => JSX.Element }
type Dispose = () => Promise<void>
interface Host { resolve(target: { directory: string }): { tui?: string }; load(entrypoint: string): Promise<unknown> }
interface ContextFactory {
  createPluginContext(input: {
    host: object; id: string; options: undefined; owned: Dispose[];
    registry: { has(kind: string, name: string): boolean; set(kind: string, name: string, claim: Pick<Claim, "placement" | "render">): void; remove(kind: string, name: string): void; active(): boolean }
  }): Plugin.Context
}
interface Structure {
  resolveSlots(input: { paths: ReadonlySet<string>; claims: readonly Claim[] }): { slotted: ReadonlyMap<string, { append: readonly Claim[] }> }
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}; use scripts/installed-smoke.ts`); return value }
const usage = { input: 100, output: 20, reasoning: 0, cache: { read: 10, write: 0 } }
function session(id: string, parentID?: string, created = 1): SessionInfo {
  return { id, parentID, agent: "review", title: "Smoke", projectID: "project", location: { directory: "D:/smoke" }, cost: 0.2, tokens: usage, time: { created, updated: 10 } }
}
function answer(cost: number): Extract<SessionMessageInfo, { type: "assistant" }> {
  return { id: "answer", type: "assistant", agent: "review", model: { providerID: "provider", id: "model" }, time: { created: 1000, streamed: 1500, completed: 2000 }, content: [], tokens: usage, cost }
}
function point(frame: string, label: string) {
  const lines = frame.split("\n")
  const y = lines.findIndex((line) => line.includes(label))
  if (y < 0) throw new Error(`Missing ${label}:\n${frame}`)
  return { x: lines[y].indexOf(label), y }
}
async function flush() { for (let index = 0; index < 20; index++) await Promise.resolve() }

test("installed v2 directory and file URL render through the real loader for 20 mount lifecycles", async () => {
  const target = await realpath(required("RICH_FOOTER_INSTALLED"))
  const nextLabel = process.env.RICH_FOOTER_EXPECTED_NEXT ?? "Next"
  const hostRoot = required("RICH_FOOTER_HOST")
  const host = await import(pathToFileURL(path.join(hostRoot, "packages/plugin/src/host.ts")).href) as Host
  const factory = await import(pathToFileURL(path.join(hostRoot, "packages/tui/src/plugin/api.tsx")).href) as ContextFactory
  const structure = await import(pathToFileURL(path.join(hostRoot, "packages/tui/src/plugin/structure.ts")).href) as Structure
  const runtimeID = (name: string) => `opentui:runtime-module:${encodeURIComponent(name)}`
  expect((await import(runtimeID("solid-js")) as { createSignal: unknown }).createSignal).toBe(createSignal)
  expect((await import(runtimeID("solid-js/store")) as { createStore: unknown }).createStore).toBe(createStore)
  expect((await import(runtimeID("@opentui/solid")) as { createComponent: unknown }).createComponent).toBe(createComponent)
  expect((await import(runtimeID("@opentui/core")) as { RGBA: unknown }).RGBA).toBe(RGBA)
  let cycles = 0
  for (const spec of [target, pathToFileURL(target).href]) {
    const entry = host.resolve({ directory: spec.startsWith("file:") ? fileURLToPath(spec) : spec }).tui
    if (!entry) throw new Error(`Installed v2 entry not discovered: ${spec}`)
    expect(await realpath(entry.startsWith("file:") ? fileURLToPath(entry) : entry)).toBe(await realpath(path.join(target, "tui.js")))
    const mod = await host.load(entry) as { default: Plugin.Definition }
    expect(mod.default.id).toBe("opencode-rich-footer")
    const [id, setID] = createSignal("a")
    const [sessions, setSessions] = createSignal([session("parent"), session("a", "parent"), session("b", "parent", 2)])
    const [messages, setMessages] = createSignal<SessionMessageInfo[]>([answer(0.2)])
    const [input, setInput] = createSignal("")
    const listeners = new Set<Parameters<V2Context["data"]["listen"]>[0]>()
    const layers = new Set<Parameters<V2Context["keymap"]["layer"]>[0]>()
    const destinations: string[] = []
    const [claims, setClaims] = createSignal<readonly Claim[]>([])
    const owned: Dispose[] = []
    const synthetic: V2Context = {
      location: { directory: "D:/smoke" },
      client: { session: { list: async (request) => ({ data: sessions().filter((item) => item.parentID === request?.parentID), cursor: {} }) } },
      data: {
        listen(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
        session: { get: (key) => sessions().find((item) => item.id === key), list: sessions, status: () => "running", sync: async () => {}, message: { list: messages, sync: async () => {} } },
        location: { default: () => ({ directory: "D:/smoke" }), model: { list: () => [], sync: async () => {} } },
      },
      keymap: { shortcuts: () => [], layer(layer) { layers.add(layer); onCleanup(() => { layers.delete(layer) }) } },
      ui: { router: { current: () => ({ type: "session", sessionID: id() }), navigate(route) { if (route.type === "session") destinations.push(route.sessionID) } } },
      theme: { text: { base: RGBA.fromHex("#eeeeee"), muted: RGBA.fromHex("#aaaaaa") }, border: { base: RGBA.fromHex("#777777") }, background: { raised: { base: RGBA.fromHex("#111111"), high: RGBA.fromHex("#222222") } } },
    }
    const realContext = factory.createPluginContext({
      id: mod.default.id, options: undefined, owned,
      host: { app: { version: "smoke", channel: "test" }, client: { api: {} }, keymap: {}, shortcuts: {}, keymapState: {}, sessionTabs: {}, local: {} },
      registry: {
        has: (_kind, key) => claims().some((claim) => claim.key === key),
        set(kind, key, value) { if (kind !== "slots") throw new Error(`Unexpected registration ${kind}`); setClaims((items) => [...items, { ...value, key, plugin: mod.default.id }]) },
        remove: (_kind, key) => setClaims((items) => items.filter((claim) => claim.key !== key)), active: () => true,
      },
    })
    const context = { ...synthetic, ui: { router: synthetic.ui.router, slot: realContext.ui.slot } } as unknown as Plugin.Context
    function HostSlot() {
      const resolved = createMemo(() => structure.resolveSlots({ paths: new Set(["session.composer.top"]), claims: claims() }))
      return <For each={resolved().slotted.get("session.composer.top")?.append ?? []}>{(claim) => createSolidComponent(claim.render, { get sessionID() { return id() } })}</For>
    }
    const setup = await testRender(() => <box><input focused onInput={setInput} /><HostSlot /></box>, { width: 80, height: 12 })
    const baselineListeners = setup.renderer.keyInput.listenerCount("keypress")
    const intervals = spyOn(globalThis, "setInterval")
    const clears = spyOn(globalThis, "clearInterval")
    let cleanup: Plugin.Cleanup | void = undefined
    try {
      // Mount/unmount the installed module; P1 separately tests graph reloads.
      for (let cycle = 0; cycle < 10; cycle++) {
        cleanup = await mod.default.setup(context)
        expect(claims()).toHaveLength(1)
        expect(claims()[0].placement).toEqual({ kind: "append", target: "session.composer.top" })
        await flush()
        await setup.renderOnce()
        expect(setup.captureCharFrame()).toContain("session $0.20")
        expect(setup.captureCharFrame()).toContain(nextLabel)
        expect(listeners.size).toBe(1)
        expect(layers.size).toBe(1)
        await setup.mockInput.typeText("x")
        expect(input()).toBe("x".repeat(cycle + 1))
        const focused = setup.renderer.currentFocusedRenderable
        const next = point(setup.captureCharFrame(), nextLabel)
        await setup.mockMouse.click(next.x, next.y)
        expect(destinations.at(-1)).toBe("b")
        expect(setup.renderer.currentFocusedRenderable).toBe(focused)
        setSessions((items) => items.map((item) => item.id === "a" ? { ...item, cost: 1.25 } : item))
        setMessages([answer(1.25)])
        await setup.renderOnce()
        expect(setup.captureCharFrame()).toContain("session $1.25")
        setID("parent")
        await flush()
        await setup.renderOnce()
        expect(setup.captureCharFrame()).not.toContain("Parent")
        expect(listeners.size).toBe(0)
        expect(layers.size).toBe(0)
        setID("a")
        await flush()
        await setup.renderOnce()
        await cleanup?.()
        cleanup = undefined
        await setup.renderOnce()
        expect(claims()).toHaveLength(0)
        expect(setup.captureCharFrame()).not.toContain("response")
        expect(setup.renderer.keyInput.listenerCount("keypress")).toBe(baselineListeners)
        expect(listeners.size).toBe(0)
        expect(layers.size).toBe(0)
        const handles = intervals.mock.calls.flatMap(([callback], index) => {
          const result = intervals.mock.results[index]
          return typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return" ? [result.value] : []
        })
        expect(handles.length).toBeGreaterThan(cycle)
        for (const handle of handles) expect(clears.mock.calls.map(([value]) => value)).toContain(handle)
        setSessions([session("parent"), session("a", "parent"), session("b", "parent", 2)])
        setMessages([answer(0.2)])
        cycles++
      }
    } finally { await cleanup?.(); for (const dispose of owned) await dispose(); setup.renderer.destroy(); intervals.mockRestore(); clears.mockRestore() }
  }
  expect(cycles).toBe(20)
  console.log("INSTALLED_RENDER_VALIDATED", JSON.stringify({ target, nextLabel, cycles }))
}, 60_000)

test("installed v2 missing artifact fails, then recovers and observes updates in fresh processes without local peers", async () => {
  const base = await realpath(tmpdir())
  const fixture = await realpath(await mkdtemp(path.join(base, "installed-v2-artifact-ação 日本 ")))
  try {
    const installed = required("RICH_FOOTER_INSTALLED")
    await cp(path.join(installed, "package.json"), path.join(fixture, "package.json"))
    await cp(path.join(installed, "tui.js"), path.join(fixture, "tui.js"))
    const manifest = JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8")) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> }
    for (const peer of ["solid-js", "@opentui/core", "@opentui/solid"]) expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true)
    const runtime = path.join(required("RICH_FOOTER_HOST"), "packages/tui")
    const hostURL = pathToFileURL(path.join(required("RICH_FOOTER_HOST"), "packages/plugin/src/host.ts")).href
    function readFailureInFreshProcess() {
      const script = [
        `const host = await import(${JSON.stringify(hostURL)})`,
        `const entry = host.resolve({directory:${JSON.stringify(fixture)}}).tui`,
        'if (!entry) throw new Error("Fixture TUI entry not discovered")',
        'let failed = false; try { await host.load(entry) } catch(error) { failed = true; console.log("EXPECTED_ARTIFACT_FAILURE", String(error)) }; if (!failed) throw new Error("Missing artifact unexpectedly loaded")',
      ].join("\n")
      return Bun.spawnSync([process.execPath, "--preload", required("RICH_FOOTER_PRELOAD"), "--eval", script], { cwd: runtime, env: process.env, stdout: "pipe", stderr: "pipe" })
    }
    const failure = readFailureInFreshProcess()
    if (failure.exitCode) throw new Error(`Missing-artifact subprocess failed: ${failure.stderr.toString()}\n${failure.stdout.toString()}`)
    expect(failure.exitCode).toBe(0)
    expect(failure.stdout.toString()).toContain("EXPECTED_ARTIFACT_FAILURE")
    expect(await access(path.join(fixture, "node_modules")).then(() => true, () => false)).toBe(false)
    // Copy the real package graph only for this independent adversarial fixture.
    await cp(path.join(installed, "dist"), path.join(fixture, "dist"), { recursive: true })
    async function assertIndependentGraph(directory: string) {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, item.name)
        if (item.isDirectory()) { await assertIndependentGraph(file); continue }
        if (!item.name.endsWith(".js")) continue
        for (const dependency of new Bun.Transpiler({ loader: "js" }).scan(await readFile(file, "utf8")).imports) {
          if (dependency.path.startsWith("opentui:runtime-module:")) continue
          expect(dependency.path.startsWith("./") || dependency.path.startsWith("../")).toBe(true)
          const resolved = await realpath(path.resolve(directory, dependency.path))
          expect(resolved.startsWith(fixture + path.sep)).toBe(true)
        }
      }
    }
    await assertIndependentGraph(fixture)
    function renderInFreshProcess(nextLabel: string) {
      return Bun.spawnSync([process.execPath, "test", "--preload", required("RICH_FOOTER_PRELOAD"), "--timeout", "60000", "--test-name-pattern", "^installed v2 directory", fileURLToPath(import.meta.url)], {
        cwd: runtime, env: { ...process.env, RICH_FOOTER_INSTALLED: fixture, RICH_FOOTER_EXPECTED_NEXT: nextLabel }, stdout: "pipe", stderr: "pipe",
      })
    }
    const original = renderInFreshProcess("Next")
    if (original.exitCode) throw new Error(`Recovered package render failed: ${original.stderr.toString()}\n${original.stdout.toString()}`)
    expect(original.exitCode).toBe(0)
    expect(original.stdout.toString()).toContain('"nextLabel":"Next"')
    const footer = path.join(fixture, "dist/footer.js")
    const originalFooter = await readFile(footer, "utf8")
    expect(originalFooter.match(/next:\s*"Next"/g)).toHaveLength(1)
    await writeFile(footer, originalFooter.replace(/next:\s*"Next"/, 'next: "Move"'))
    const updated = renderInFreshProcess("Move")
    if (updated.exitCode) throw new Error(`Updated package render failed: ${updated.stderr.toString()}\n${updated.stdout.toString()}`)
    expect(updated.exitCode).toBe(0)
    expect(updated.stdout.toString()).toContain('"nextLabel":"Move"')
    expect(await access(path.join(fixture, "node_modules")).then(() => true, () => false)).toBe(false)
  } finally {
    const resolved = await realpath(fixture)
    if (path.dirname(resolved).toLowerCase() !== base.toLowerCase() || !path.basename(resolved).startsWith("installed-v2-artifact-")) throw new Error("Artifact fixture escaped sandbox")
    await rm(resolved, { recursive: true, force: true })
  }
}, 60_000)
