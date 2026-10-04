/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { access, cp, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { RGBA } from "@opentui/core"
import { createComponent, createSlot, createSolidSlotRegistry, testRender, useRenderer } from "@opentui/solid"
import { createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import type { TuiPlugin, TuiSlotContext, TuiSlotMap } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message, Session } from "@opencode-ai/sdk/v2"
import type { V1SourceApi } from "../src/adapters/v1"

type Api = Parameters<TuiPlugin>[0]
type Resolved = { spec: string; entry: string; target: string; source: "file" | "npm"; deprecated: boolean; options: undefined }
interface Loader {
  resolve(plan: { spec: string; deprecated: boolean; options: undefined }, kind: "tui"): Promise<{ ok: true; value: Resolved } | { ok: false; stage: string; error?: unknown }>
  load(row: Resolved): Promise<{ ok: true; value: { mod: Record<string, unknown> } } | { ok: false; error: unknown }>
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}; use scripts/installed-smoke.ts`); return value }
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

test("installed v1 directory and file URL render through the real loader for 20 mount lifecycles", async () => {
  const target = await realpath(required("RICH_FOOTER_INSTALLED"))
  const nextLabel = process.env.RICH_FOOTER_EXPECTED_NEXT ?? "Next"
  const runtime = path.join(required("RICH_FOOTER_HOST"), "packages/opencode")
  const { PluginLoader: loader } = await import(pathToFileURL(path.join(runtime, "src/plugin/loader.ts")).href) as { PluginLoader: Loader }
  const shared = await import(pathToFileURL(path.join(runtime, "src/plugin/shared.ts")).href) as { readV1Plugin(mod: Record<string, unknown>, spec: string, kind: "tui"): { id: string; tui: TuiPlugin } }
  const runtimeID = (name: string) => `opentui:runtime-module:${encodeURIComponent(name)}`
  expect((await import(runtimeID("solid-js")) as { createSignal: unknown }).createSignal).toBe(createSignal)
  expect((await import(runtimeID("solid-js/store")) as { createStore: unknown }).createStore).toBe(createStore)
  expect((await import(runtimeID("@opentui/solid")) as { createComponent: unknown }).createComponent).toBe(createComponent)
  expect((await import(runtimeID("@opentui/core")) as { RGBA: unknown }).RGBA).toBe(RGBA)
  let cycles = 0
  for (const spec of [target, pathToFileURL(target).href]) {
    const resolved = await loader.resolve({ spec, deprecated: false, options: undefined }, "tui")
    if (!resolved.ok) throw new Error(`Installed v1 resolve failed (${resolved.stage}): ${String(resolved.error)}`)
    expect(await realpath(fileURLToPath(resolved.value.entry))).toBe(await realpath(path.join(target, "tui.js")))
    const loaded = await loader.load(resolved.value)
    if (!loaded.ok) throw loaded.error
    const plugin = shared.readV1Plugin(loaded.value.mod, spec, "tui")
    expect(plugin.id).toBe("opencode-rich-footer")
    const [id, setID] = createSignal("child")
    const [messages, setMessages] = createSignal<readonly Message[]>([answer(0.2)])
    const [input, setInput] = createSignal("")
    const commands: string[] = []
    const sessions = [session("parent"), session("child", "parent"), session("other", "parent")]
    const controller = new AbortController()
    const source: V1SourceApi = {
      client: {},
      state: { provider: [], path: { state: "state", config: "config", directory: "D:/smoke", worktree: "D:/smoke" }, part: () => [], session: { get: (key) => sessions.find((entry) => entry.id === key), messages, status: () => ({ type: "busy" }), children: () => sessions.filter((entry) => entry.parentID) } },
      theme: { current: { text: RGBA.fromHex("#eeeeee"), textMuted: RGBA.fromHex("#aaaaaa"), border: RGBA.fromHex("#777777"), backgroundPanel: RGBA.fromHex("#111111"), backgroundElement: RGBA.fromHex("#222222") } as Api["theme"]["current"] },
      keys: { formatBindings: () => "P" }, tuiConfig: { keybinds: { get: () => [] } },
      keymap: { dispatchCommand: (command) => { commands.push(`${id()}:${command}`); return { ok: true } } },
      lifecycle: { signal: controller.signal }, ui: { toast: (toast) => { throw new Error(toast.message) } },
    }
    let unregister: (() => void) | undefined
    let activeSlots = 0
    let api!: Api
    function App() {
      const registry = createSolidSlotRegistry<TuiSlotMap, TuiSlotContext>(useRenderer(), { theme: source.theme as Api["theme"] })
      const Slot = createSlot(registry)
      api = { ...source, slots: { register: (claim: Parameters<Api["slots"]["register"]>[0]) => {
        const cleanup = registry.register({ ...claim, id: plugin.id })
        activeSlots++
        let active = true
        unregister = () => { if (active) { active = false; activeSlots--; cleanup() } }
        return unregister
      } } } as unknown as Api
      return <box><input focused onInput={setInput} /><Slot name="session_footer" session_id={id()} /></box>
    }
    const setup = await testRender(() => <App />, { width: 80, height: 12 })
    const baselineListeners = setup.renderer.keyInput.listenerCount("keypress")
    const intervals = spyOn(globalThis, "setInterval")
    const clears = spyOn(globalThis, "clearInterval")
    try {
      // Mount/unmount the installed module; P1 separately tests graph reloads.
      for (let cycle = 0; cycle < 10; cycle++) {
        await plugin.tui(api, undefined, { id: plugin.id, spec, source: "file", target: resolved.value.target, first_time: 1, last_time: cycle + 1, time_changed: 1, load_count: 1, fingerprint: "installed", state: "same" })
        await setup.renderOnce()
        expect(activeSlots).toBe(1)
        expect(setup.captureCharFrame()).toContain("loaded $0.20")
        expect(setup.captureCharFrame()).toContain(nextLabel)
        await setup.mockInput.typeText("x")
        expect(input()).toBe("x".repeat(cycle + 1))
        const focused = setup.renderer.currentFocusedRenderable
        const next = point(setup.captureCharFrame(), nextLabel)
        await setup.mockMouse.click(next.x, next.y)
        expect(commands.at(-1)).toBe("child:session.child.next")
        expect(setup.renderer.currentFocusedRenderable).toBe(focused)
        setMessages([answer(1.25)])
        await setup.renderOnce()
        expect(setup.captureCharFrame()).toContain("loaded $1.25")
        setID("parent")
        await setup.renderOnce()
        expect(setup.captureCharFrame()).toContain("response")
        expect(setup.captureCharFrame()).toContain("loaded $1.25")
        for (const label of ["Parent", "Prev", nextLabel]) expect(setup.captureCharFrame()).not.toContain(label)
        setID("child")
        await setup.renderOnce()
        unregister?.()
        await setup.renderOnce()
        expect(activeSlots).toBe(0)
        expect(setup.captureCharFrame()).not.toContain("response")
        expect(setup.renderer.keyInput.listenerCount("keypress")).toBe(baselineListeners)
        const handles = intervals.mock.calls.flatMap(([callback], index) => {
          const result = intervals.mock.results[index]
          return typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return" ? [result.value] : []
        })
        expect(handles.length).toBeGreaterThan(cycle)
        for (const handle of handles) expect(clears.mock.calls.map(([value]) => value)).toContain(handle)
        setMessages([answer(0.2)])
        cycles++
      }
    } finally { controller.abort(); unregister?.(); setup.renderer.destroy(); intervals.mockRestore(); clears.mockRestore() }
  }
  expect(cycles).toBe(20)
  console.log("INSTALLED_RENDER_VALIDATED", JSON.stringify({ target, nextLabel, cycles }))
}, 60_000)

test("installed v1 missing artifact fails, then recovers and observes updates in fresh processes without local peers", async () => {
  const base = await realpath(tmpdir())
  const fixture = await realpath(await mkdtemp(path.join(base, "installed-v1-artifact-ação 日本 ")))
  try {
    const installed = required("RICH_FOOTER_INSTALLED")
    await cp(path.join(installed, "package.json"), path.join(fixture, "package.json"))
    await cp(path.join(installed, "tui.js"), path.join(fixture, "tui.js"))
    const manifest = JSON.parse(await readFile(path.join(fixture, "package.json"), "utf8")) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> }
    for (const peer of ["solid-js", "@opentui/core", "@opentui/solid"]) expect(manifest.peerDependenciesMeta?.[peer]?.optional).toBe(true)
    const runtime = path.join(required("RICH_FOOTER_HOST"), "packages/opencode")
    const loaderURL = pathToFileURL(path.join(runtime, "src/plugin/loader.ts")).href
    function readFailureInFreshProcess() {
      const script = [
        `const { PluginLoader } = await import(${JSON.stringify(loaderURL)})`,
        `const resolved = await PluginLoader.resolve({spec:${JSON.stringify(fixture)},deprecated:false,options:undefined},"tui")`,
        'if (!resolved.ok) throw new Error(`resolve: ${resolved.stage}`)',
        "const loaded = await PluginLoader.load(resolved.value)",
        'if (loaded.ok) throw new Error("Missing artifact unexpectedly loaded"); console.log("EXPECTED_ARTIFACT_FAILURE", String(loaded.error))',
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
      return Bun.spawnSync([process.execPath, "test", "--preload", required("RICH_FOOTER_PRELOAD"), "--timeout", "60000", "--test-name-pattern", "^installed v1 directory", fileURLToPath(import.meta.url)], {
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
    if (path.dirname(resolved).toLowerCase() !== base.toLowerCase() || !path.basename(resolved).startsWith("installed-v1-artifact-")) throw new Error("Artifact fixture escaped sandbox")
    await rm(resolved, { recursive: true, force: true })
  }
}, 60_000)
