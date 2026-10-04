/** @jsxImportSource @opentui/solid */
import { describe, expect, spyOn, test } from "bun:test"
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { RGBA } from "@opentui/core"
import { createComponent, createSlot, createSolidSlotRegistry, testRender, useRenderer } from "@opentui/solid"
import * as jsxRuntime from "@opentui/solid/jsx-runtime"
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import type { TuiPlugin, TuiSlotContext, TuiSlotMap } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message, Session } from "@opencode-ai/sdk/v2"
import type { V1SourceApi } from "../src/adapters/v1"

type Api = Parameters<TuiPlugin>[0]
type Loaded = { mod: Record<string, unknown>; entry: string }
type Resolved = { spec: string; entry: string; target: string; source: "file" | "npm"; deprecated: boolean; options: undefined }
interface Loader {
  resolve(plan: { spec: string; deprecated: boolean; options: undefined }, kind: "tui"): Promise<{ ok: true; value: Resolved } | { ok: false; stage: string; error?: unknown }>
  load(row: Resolved): Promise<{ ok: true; value: Loaded } | { ok: false; error: unknown }>
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; run scripts/test.ts --v1`)
  return value
}
function session(id: string, parentID?: string): Session {
  return { id, parentID, slug: id, projectID: "project", directory: "D:/smoke", title: "@review subagent", version: "1", time: { created: 1, updated: 2 } }
}
function answer(cost: number): AssistantMessage {
  return { id: "answer", role: "assistant", sessionID: "child", parentID: "question", agent: "review", mode: "primary", providerID: "provider", modelID: "model", path: { cwd: "D:/smoke", root: "D:/smoke" }, time: { created: 1000, completed: 2000 }, cost, tokens: { input: 100, output: 20, reasoning: 0, cache: { read: 10, write: 0 } } }
}
function point(frame: string, label: string) {
  const lines = frame.split("\n")
  const y = lines.findIndex((line) => line.includes(label))
  if (y < 0) throw new Error(`Missing ${label}:\n${frame}`)
  return { x: lines[y].indexOf(label), y }
}

describe("v1 real loader smoke", () => {
  test("directory and file URL load, mount, update, navigate and reload with conflicting runtimes", async () => {
    const root = required("RICH_FOOTER_ROOT")
    const host = required("RICH_FOOTER_HOST")
    const runtime = path.join(host, "packages/opencode")
    const loaderModule = await import(pathToFileURL(path.join(runtime, "src/plugin/loader.ts")).href) as { PluginLoader: Loader }
    const shared = await import(pathToFileURL(path.join(runtime, "src/plugin/shared.ts")).href) as { readV1Plugin(mod: Record<string, unknown>, spec: string, kind: "tui"): { id: string; tui: TuiPlugin } }
    const temporaryRoot = await realpath(tmpdir())
    const temporary = await realpath(await mkdtemp(path.join(temporaryRoot, "rich footer v1 ação 日本 ")))
    try {
      await cp(path.join(root, "package.json"), path.join(temporary, "package.json"))
      await cp(path.join(root, "tui.js"), path.join(temporary, "tui.js"))
      // The runner stages either the real build or its coverage-instrumented equivalent.
      await cp(fileURLToPath(new URL("../src", import.meta.url)), path.join(temporary, "dist"), { recursive: true })
      await writeFile(path.join(temporary, "dist/adapters/v2.js"), 'throw new Error("inactive v2 adapter was imported")\n')
      const runtimeID = (specifier: string) => `opentui:runtime-module:${encodeURIComponent(specifier)}`
      await writeFile(path.join(temporary, "probe.js"), [
        `export { createSignal as probeSignal } from ${JSON.stringify(runtimeID("solid-js"))};`,
        `export { createStore as probeStore } from ${JSON.stringify(runtimeID("solid-js/store"))};`,
        `export { createComponent as probeComponent } from ${JSON.stringify(runtimeID("@opentui/solid"))};`,
        `export { RGBA as probeRGBA } from ${JSON.stringify(runtimeID("@opentui/core"))};`,
        `export * as probeJSX from ${JSON.stringify(runtimeID("@opentui/solid/jsx-runtime"))};`,
      ].join("\n"))
      await writeFile(path.join(temporary, "tui.js"), (await readFile(path.join(temporary, "tui.js"), "utf8")) + '\nexport * from "./probe.js";\n')
      const opposing = path.join(process.env.RICH_FOOTER_V2_HOST ?? "D:/git/opencode-rich-footer-host-v2", "packages/tui/node_modules")
      for (const name of ["solid-js", "@opentui/solid"]) {
        const destination = path.join(temporary, "node_modules", name)
        await mkdir(path.dirname(destination), { recursive: true })
        await cp(await realpath(path.join(opposing, name)), destination, { recursive: true, dereference: true })
        const conflict = JSON.parse(await readFile(path.join(destination, "package.json"), "utf8")) as { version: string }
        const canonical = JSON.parse(await readFile(path.join(runtime, "node_modules", name, "package.json"), "utf8")) as { version: string }
        expect(conflict.version).not.toBe(canonical.version)
      }
      let cycles = 0
      for (const spec of [temporary, pathToFileURL(temporary).href]) {
        const resolution = await loaderModule.PluginLoader.resolve({ spec, deprecated: false, options: undefined }, "tui")
        if (!resolution.ok) throw new Error(`Host resolve failed (${resolution.stage}): ${String(resolution.error)}`)
        expect(await realpath(fileURLToPath(resolution.value.entry))).toBe(await realpath(path.join(temporary, "tui.js")))
        const loaded = await loaderModule.PluginLoader.load(resolution.value)
        if (!loaded.ok) throw loaded.error
        const mod = loaded.value.mod
        expect(mod.probeSignal).toBe(createSignal)
        expect(mod.probeStore).toBe(createStore)
        expect(mod.probeComponent).toBe(createComponent)
        expect(mod.probeRGBA).toBe(RGBA)
        const probeJSX = mod.probeJSX as typeof jsxRuntime
        for (const key of Object.keys(jsxRuntime) as (keyof typeof jsxRuntime)[]) expect(probeJSX[key]).toBe(jsxRuntime[key])
        let plugin = shared.readV1Plugin(mod, spec, "tui")
        expect(plugin.id).toBe("opencode-rich-footer")
        const [id, setID] = createSignal("child")
        const [messages, setMessages] = createSignal<readonly Message[]>([answer(0.2)])
        const [color, setColor] = createSignal(RGBA.fromHex("#eeeeee"))
        const [input, setInput] = createSignal("")
        const commands: string[] = []
        const controller = new AbortController()
        const sessions = [session("parent"), session("child", "parent"), session("other", "parent")]
        // Synthetic data/services only; the registry and bound slot are the host's OpenTUI APIs.
        const source: V1SourceApi = {
          client: {},
          state: { provider: [], path: { state: "state", config: "config", directory: "D:/smoke", worktree: "D:/smoke" }, part: () => [], session: { get: (key) => sessions.find((entry) => entry.id === key), messages, status: () => ({ type: "busy" }), children: () => sessions.filter((entry) => entry.parentID) } },
          theme: { get current() { return { text: color(), textMuted: color(), border: color(), backgroundPanel: RGBA.fromHex("#111111"), backgroundElement: RGBA.fromHex("#222222") } as Api["theme"]["current"] } },
          keys: { formatBindings: () => "P" }, tuiConfig: { keybinds: { get: () => [] } },
          keymap: { dispatchCommand: (command) => { commands.push(`${id()}:${command}`); return { ok: true } } },
          lifecycle: { signal: controller.signal }, ui: { toast: (toast) => { throw new Error(toast.message) } },
        }
        let unregister: (() => void) | undefined
        let api!: Api
        function App() {
          const registry = createSolidSlotRegistry<TuiSlotMap, TuiSlotContext>(useRenderer(), { theme: source.theme as Api["theme"] })
          const Slot = createSlot(registry)
          api = { ...source, slots: { register: (claim: Parameters<Api["slots"]["register"]>[0]) => { unregister = registry.register({ ...claim, id: plugin.id }); return unregister } } } as unknown as Api
          return <box><input focused onInput={setInput} /><Slot name="session_footer" session_id={id()} /></box>
        }
        const setup = await testRender(() => <App />, { width: 80, height: 12 })
        const intervals = spyOn(globalThis, "setInterval")
        const clears = spyOn(globalThis, "clearInterval")
        try {
          for (let cycle = 0; cycle < 10; cycle++) {
            // v1 has no graph hot-reloader. A fresh local installation path forces
            // its real loader to evaluate the entire graph, like a fresh process.
            const generation = path.join(temporary, `generation-${cycles}`)
            await mkdir(generation)
            for (const file of ["package.json", "tui.js", "probe.js", "dist"]) await cp(path.join(temporary, file), path.join(generation, file), { recursive: true })
            const discovered = await loaderModule.PluginLoader.resolve({ spec: spec.startsWith("file:") ? pathToFileURL(generation).href : generation, deprecated: false, options: undefined }, "tui")
            if (!discovered.ok) throw new Error(`Reload discovery failed: ${discovered.stage}`)
            const reloaded = await loaderModule.PluginLoader.load(discovered.value)
            if (!reloaded.ok) throw reloaded.error
            expect(reloaded.value.mod.probeSignal).toBe(createSignal)
            expect(reloaded.value.mod.probeComponent).toBe(createComponent)
            const previous = plugin
            plugin = shared.readV1Plugin(reloaded.value.mod, discovered.value.spec, "tui")
            expect(plugin.tui).not.toBe(previous.tui)
            await plugin.tui(api, undefined, {
              id: plugin.id, spec, source: "file", target: resolution.value.target,
              first_time: 1, last_time: cycle + 1, time_changed: 1,
              load_count: cycle + 1, fingerprint: "smoke", state: cycle === 0 ? "first" : "same",
            })
            await setup.renderOnce()
            expect(setup.captureCharFrame()).toContain("Review")
            expect(setup.captureCharFrame()).toContain("loaded $0.20")
            const count = setup.renderer.keyInput.listenerCount("keypress")
            await setup.mockInput.typeText("x")
            expect(input()).toBe("x".repeat(cycle + 1))
            const focused = setup.renderer.currentFocusedRenderable
            let target = point(setup.captureCharFrame(), "Parent")
            await setup.mockMouse.click(target.x, target.y)
            expect(commands.at(-1)).toBe("child:session.parent")
            expect(setup.renderer.currentFocusedRenderable).toBe(focused)
            setColor(RGBA.fromHex("#ff8800"))
            setMessages([answer(1.25)])
            await setup.renderOnce()
            expect(setup.captureCharFrame()).toContain("loaded $1.25")
            const span = setup.captureSpans().lines.flatMap((line) => line.spans).find((entry) => entry.text.includes("Parent"))
            expect(span?.fg.equals(RGBA.fromHex("#ff8800"))).toBe(true)
            setID("other")
            await setup.renderOnce()
            target = point(setup.captureCharFrame(), "Next")
            await setup.mockMouse.click(target.x, target.y)
            expect(commands.at(-1)).toBe("other:session.child.next")
            setID("parent")
            await setup.renderOnce()
            expect(setup.captureCharFrame()).not.toContain("Parent")
            setID("child")
            await setup.renderOnce()
            unregister?.()
            await setup.renderOnce()
            expect(setup.captureCharFrame()).not.toContain("response")
            expect(setup.renderer.keyInput.listenerCount("keypress")).toBe(count)
            const timerHandles = intervals.mock.calls.flatMap(([callback], index) => {
              const result = intervals.mock.results[index]
              return typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return" ? [result.value] : []
            })
            expect(timerHandles.length).toBeGreaterThan(cycle)
            for (const handle of timerHandles) expect(clears.mock.calls.map(([cleared]) => cleared)).toContain(handle)
            setID("child")
            setMessages([answer(0.2)])
            cycles++
          }
        } finally {
          controller.abort()
          unregister?.()
          setup.renderer.destroy()
          intervals.mockRestore()
          clears.mockRestore()
        }
      }
      expect(cycles).toBe(20)
    } finally {
      const target = await realpath(temporary)
      if (!path.isAbsolute(target) || path.dirname(target).toLowerCase() !== temporaryRoot.toLowerCase() || !path.basename(target).startsWith("rich footer v1 ação 日本 ")) {
        throw new Error(`Refusing to remove unexpected fixture path ${target}`)
      }
      await rm(target, { recursive: true, force: true })
    }
  }, 30_000)
})
