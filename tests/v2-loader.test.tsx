/** @jsxImportSource @opentui/solid */
import { describe, expect, spyOn, test } from "bun:test"
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { RGBA } from "@opentui/core"
import { createComponent, testRender, type JSX } from "@opentui/solid"
import * as jsxRuntime from "@opentui/solid/jsx-runtime"
import { createComponent as createSolidComponent, createMemo, createSignal, For, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { Plugin } from "@opencode/plugin/tui"
import type { SessionInfo, SessionMessageInfo } from "@opencode/client"
import type { V2Context } from "../src/adapters/v2"

type Render = (input: { readonly sessionID: string }) => JSX.Element
type Claim = { key: string; plugin: string; placement: { kind: "append"; target: string }; render: Render }
type Registered = Pick<Claim, "placement" | "render">
type Dispose = () => Promise<void>
interface Host {
  resolve(target: { directory: string }): { tui?: string }
  load(entrypoint: string): Promise<unknown>
}
interface ContextFactory {
  createPluginContext(input: {
    host: object; id: string; options: undefined; owned: Dispose[];
    registry: { has(kind: string, name: string): boolean; set(kind: string, name: string, claim: Registered): void; remove(kind: string, name: string): void; active(): boolean }
  }): Plugin.Context
}
interface Structure {
  resolveSlots(input: { paths: ReadonlySet<string>; claims: readonly Claim[] }): { slotted: ReadonlyMap<string, { append: readonly Claim[] }>; suppressed: readonly unknown[]; degraded: readonly unknown[] }
}
function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; run scripts/test.ts --v2`)
  return value
}
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

describe("v2 real loader smoke", () => {
  test("directory and file URL load, mount, update, navigate and reload with conflicting runtimes", async () => {
    const root = required("RICH_FOOTER_ROOT")
    const hostRoot = required("RICH_FOOTER_HOST")
    const host = await import(pathToFileURL(path.join(hostRoot, "packages/plugin/src/host.ts")).href) as Host
    const factory = await import(pathToFileURL(path.join(hostRoot, "packages/tui/src/plugin/api.tsx")).href) as ContextFactory
    const structure = await import(pathToFileURL(path.join(hostRoot, "packages/tui/src/plugin/structure.ts")).href) as Structure
    const sourceModule = await import(pathToFileURL(path.join(hostRoot, "packages/plugin/src/source.ts")).href) as {
      createPluginSources(watch: (file: string) => Promise<void>): { read(entry: string): Promise<{ version: string; module: unknown }>; dispose(): void }
    }
    const temporaryRoot = await realpath(tmpdir())
    const temporary = await realpath(await mkdtemp(path.join(temporaryRoot, "rich footer v2 ação 日本 ")))
    try {
      await cp(path.join(root, "package.json"), path.join(temporary, "package.json"))
      await cp(path.join(root, "tui.js"), path.join(temporary, "tui.js"))
      await cp(fileURLToPath(new URL("../src", import.meta.url)), path.join(temporary, "dist"), { recursive: true })
      await writeFile(path.join(temporary, "dist/adapters/v1.js"), 'throw new Error("inactive v1 adapter was imported")\n')
      const runtimeID = (specifier: string) => `opentui:runtime-module:${encodeURIComponent(specifier)}`
      await writeFile(path.join(temporary, "probe.js"), [
        `export { createSignal as probeSignal } from ${JSON.stringify(runtimeID("solid-js"))};`,
        `export { createStore as probeStore } from ${JSON.stringify(runtimeID("solid-js/store"))};`,
        `export { createComponent as probeComponent } from ${JSON.stringify(runtimeID("@opentui/solid"))};`,
        `export { RGBA as probeRGBA } from ${JSON.stringify(runtimeID("@opentui/core"))};`,
        `export * as probeJSX from ${JSON.stringify(runtimeID("@opentui/solid/jsx-runtime"))};`,
      ].join("\n"))
      await writeFile(path.join(temporary, "tui.js"), (await readFile(path.join(temporary, "tui.js"), "utf8")) + '\nexport * from "./probe.js";\n')
      const opposing = path.join(process.env.RICH_FOOTER_V1_HOST ?? "D:/git/opencode", "packages/opencode/node_modules")
      for (const name of ["solid-js", "@opentui/solid"]) {
        const destination = path.join(temporary, "node_modules", name)
        await mkdir(path.dirname(destination), { recursive: true })
        await cp(await realpath(path.join(opposing, name)), destination, { recursive: true, dereference: true })
        const conflict = JSON.parse(await readFile(path.join(destination, "package.json"), "utf8")) as { version: string }
        const canonical = JSON.parse(await readFile(path.join(hostRoot, "packages/tui/node_modules", name, "package.json"), "utf8")) as { version: string }
        expect(conflict.version).not.toBe(canonical.version)
      }
      let cycles = 0
      for (const spec of [temporary, pathToFileURL(temporary).href]) {
        // Match the host provider's normalization of a local file-URL target.
        const directory = spec.startsWith("file:") ? fileURLToPath(spec) : spec
        const entry = host.resolve({ directory }).tui
        if (!entry) throw new Error(`Host did not discover a TUI entry for ${spec}`)
        expect(await realpath(fileURLToPath(entry.startsWith("file:") ? entry : pathToFileURL(entry)))).toBe(await realpath(path.join(temporary, "tui.js")))
        let mod = await host.load(entry) as { default: Plugin.Definition; probeSignal: unknown; probeStore: unknown; probeComponent: unknown; probeRGBA: unknown; probeJSX: typeof jsxRuntime; revision?: number }
        expect(mod.default.id).toBe("opencode-rich-footer")
        expect(mod.probeSignal).toBe(createSignal)
        expect(mod.probeStore).toBe(createStore)
        expect(mod.probeComponent).toBe(createComponent)
        expect(mod.probeRGBA).toBe(RGBA)
        for (const key of Object.keys(jsxRuntime) as (keyof typeof jsxRuntime)[]) expect(mod.probeJSX[key]).toBe(jsxRuntime[key])
        const [id, setID] = createSignal("a")
        const [sessions, setSessions] = createSignal([session("parent"), session("a", "parent"), session("b", "parent", 2)])
        const [messages, setMessages] = createSignal<SessionMessageInfo[]>([answer(0.2)])
        const [color, setColor] = createSignal(RGBA.fromHex("#eeeeee"))
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
          keymap: { shortcuts: () => ["Alt"], layer(layer) { layers.add(layer); onCleanup(() => { layers.delete(layer) }) } },
          ui: { router: { current: () => ({ type: "session", sessionID: id() }), navigate(route) { if (route.type === "session") destinations.push(route.sessionID) } } },
          theme: { text: { get base() { return color() }, get muted() { return color() } }, border: { get base() { return color() } }, background: { raised: { base: RGBA.fromHex("#111111"), high: RGBA.fromHex("#222222") } } },
        }
        // This isolates the host slot API from application startup. Data, route and
        // keymap services are synthetic; registration, placement and rendering are real.
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
        const sources = sourceModule.createPluginSources(async () => {})
        const probe = await readFile(path.join(temporary, "probe.js"), "utf8")
        const intervals = spyOn(globalThis, "setInterval")
        const clears = spyOn(globalThis, "clearInterval")
        let cleanup: Plugin.Cleanup | void = undefined
        try {
          for (let cycle = 0; cycle < 10; cycle++) {
            await writeFile(path.join(temporary, "probe.js"), probe.replace(/\nexport const revision = \d+;\n/g, "\n") + `\nexport const revision = ${cycles};\n`)
            const previous = mod
            const reloaded = await sources.read(entry.startsWith("file:") ? entry : pathToFileURL(entry).href)
            mod = reloaded.module as typeof mod
            expect(mod.revision).toBe(cycles)
            expect(mod.default.setup).not.toBe(previous.default.setup)
            expect(mod.probeSignal).toBe(createSignal)
            expect(mod.probeStore).toBe(createStore)
            expect(mod.probeComponent).toBe(createComponent)
            cleanup = await mod.default.setup(context)
            expect(claims()).toHaveLength(1)
            expect(claims()[0].placement).toEqual({ kind: "append", target: "session.composer.top" })
            await flush()
            await setup.renderOnce()
            expect(setup.captureCharFrame()).toContain("Review")
            expect(setup.captureCharFrame()).toContain("session $0.20")
            expect(listeners.size).toBe(1)
            expect(layers.size).toBe(1)
            const count = setup.renderer.keyInput.listenerCount("keypress")
            await setup.mockInput.typeText("x")
            expect(input()).toBe("x".repeat(cycle + 1))
            const focused = setup.renderer.currentFocusedRenderable
            let target = point(setup.captureCharFrame(), "Next")
            await setup.mockMouse.click(target.x, target.y)
            expect(destinations.at(-1)).toBe("b")
            expect(setup.renderer.currentFocusedRenderable).toBe(focused)
            setColor(RGBA.fromHex("#ff8800"))
            setSessions((items) => items.map((item) => item.id === "a" ? { ...item, cost: 1.25 } : item))
            setMessages([answer(1.25)])
            await setup.renderOnce()
            expect(setup.captureCharFrame()).toContain("session $1.25")
            const span = setup.captureSpans().lines.flatMap((line) => line.spans).find((entry) => entry.text.includes("Parent"))
            expect(span?.fg.equals(RGBA.fromHex("#ff8800"))).toBe(true)
            setID("b")
            await flush()
            await setup.renderOnce()
            target = point(setup.captureCharFrame(), "Prev")
            await setup.mockMouse.click(target.x, target.y)
            expect(destinations.at(-1)).toBe("a")
            setID("parent")
            await flush()
            await setup.renderOnce()
            expect(setup.captureCharFrame()).toContain("response")
            expect(setup.captureCharFrame()).toContain("session $0.20")
            for (const label of ["Parent", "Prev", "Next"]) expect(setup.captureCharFrame()).not.toContain(label)
            expect(listeners.size).toBe(1)
            expect(layers.size).toBe(0)
            setID("a")
            await flush()
            await setup.renderOnce()
            await cleanup?.()
            cleanup = undefined
            await setup.renderOnce()
            expect(claims()).toHaveLength(0)
            expect(setup.captureCharFrame()).not.toContain("response")
            expect(setup.renderer.keyInput.listenerCount("keypress")).toBe(count)
            expect(listeners.size).toBe(0)
            expect(layers.size).toBe(0)
            const timerHandles = intervals.mock.calls.flatMap(([callback], index) => {
              const result = intervals.mock.results[index]
              return typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return" ? [result.value] : []
            })
            expect(timerHandles.length).toBeGreaterThan(cycle)
            for (const handle of timerHandles) expect(clears.mock.calls.map(([cleared]) => cleared)).toContain(handle)
            setID("a")
            setSessions([session("parent"), session("a", "parent"), session("b", "parent", 2)])
            setMessages([answer(0.2)])
            cycles++
          }
        } finally {
          await cleanup?.()
          for (const dispose of owned) await dispose()
          setup.renderer.destroy()
          sources.dispose()
          intervals.mockRestore()
          clears.mockRestore()
        }
      }
      expect(cycles).toBe(20)
    } finally {
      const target = await realpath(temporary)
      if (!path.isAbsolute(target) || path.dirname(target).toLowerCase() !== temporaryRoot.toLowerCase() || !path.basename(target).startsWith("rich footer v2 ação 日本 ")) {
        throw new Error(`Refusing to remove unexpected fixture path ${target}`)
      }
      await rm(target, { recursive: true, force: true })
    }
  }, 30_000)
})
