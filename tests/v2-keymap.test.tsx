/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { pathToFileURL } from "node:url"
import type { Plugin } from "@opencode/plugin/tui"
import type { SessionInfo } from "@opencode/client"
import { RGBA, type KeyEvent, type Renderable, type TextareaRenderable } from "@opentui/core"
import type { Binding } from "@opentui/keymap"
import { testRender } from "@opentui/solid"
import { Show, createSignal, type Accessor, type Component, type ParentProps } from "solid-js"
import { createV2Source, type V2Context } from "../src/adapters/v2"
import type { FooterSource } from "../src/contracts"
import { Footer } from "../src/footer"

type Context = Plugin.Context
type KeymapConfig = {
  readonly keybinds: { get(command: string): readonly Binding<Renderable, KeyEvent>[] }
  readonly leader?: { readonly timeout: number }
}
type HostKeymap = {
  Provider: Component<ParentProps<{ config: KeymapConfig }>>
  use(): Pick<Context["keymap"], "dispatch">
  createLayer: Context["keymap"]["layer"]
  useShortcuts(): { list: Context["keymap"]["shortcuts"] }
  useCommands(): Accessor<ReturnType<Context["keymap"]["commands"]>>
}

// These are the actual host implementations, loaded from the selected v2 checkout.
const host = process.env.RICH_FOOTER_HOST
if (!host) throw new Error("RICH_FOOTER_HOST must point to the v2 host checkout")
const keymapModule: { Keymap: HostKeymap } = await import(pathToFileURL(join(host, "packages/tui/src/context/keymap.tsx")).href)
const runtimeModule: { createTuiResolvedConfig(): KeymapConfig } = await import(pathToFileURL(join(host, "packages/tui/test/fixture/tui-runtime.ts")).href)
const configPath = join(host, "packages/tui/src/config/index.tsx")
const configModule: {
  Info: unknown
  resolve(input: unknown, options: { terminalSuspend: boolean; environment: Readonly<Record<string, string | undefined>> }): KeymapConfig
} = await import(pathToFileURL(configPath).href)
const effectModule: { Schema: { decodeUnknownSync(schema: unknown): (input: unknown) => unknown } } = await import(pathToFileURL(Bun.resolveSync("effect", configPath)).href)
const { Keymap } = keymapModule

const commandIDs = ["opencode-rich-footer.parent", "opencode-rich-footer.previous", "opencode-rich-footer.next"] as const

function session(id: string, created: number, parentID?: string): SessionInfo {
  return {
    id, parentID, projectID: "project", title: id, agent: "build",
    location: { directory: "D:/fixture" },
    time: { created, updated: created }, cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

async function setup(config = runtimeModule.createTuiResolvedConfig(), sessionID = "child-b") {
  const sessions = [session("parent", 0), session("child-a", 1, "parent"), session("child-b", 2, "parent"), session("child-c", 3, "parent")]
  const [providerVisible, setProviderVisible] = createSignal(false)
  const [footerVisible, setFooterVisible] = createSignal(false)
  const [route, setRoute] = createSignal<ReturnType<Context["ui"]["router"]["current"]>>({ type: "session", sessionID })
  const navigated: string[] = []
  const dataListeners = new Set<Parameters<V2Context["data"]["listen"]>[0]>()
  const diagnostics: string[] = []
  let editor: TextareaRenderable | undefined
  let source: FooterSource | undefined
  let dispatch: Context["keymap"]["dispatch"] | undefined
  let shortcuts: Context["keymap"]["shortcuts"] | undefined
  let commands: Accessor<ReturnType<Context["keymap"]["commands"]>> | undefined

  function Probe() {
    dispatch = Keymap.use().dispatch
    shortcuts = Keymap.useShortcuts().list
    commands = Keymap.useCommands()
    return null
  }

  function BoundFooter() {
    const currentShortcuts = Keymap.useShortcuts()
    const context: V2Context = {
      location: { directory: "D:/fixture" },
      data: {
        listen(handler) { dataListeners.add(handler); return () => { dataListeners.delete(handler) } },
        session: {
          list: () => sessions,
          get: (id) => sessions.find((entry) => entry.id === id),
          status: () => "idle",
          sync: async () => undefined,
          message: { list: () => [], sync: async () => undefined },
        },
        location: { default: () => ({ directory: "D:/fixture" }), model: { list: () => [], sync: async () => undefined } },
      },
      client: { session: { list: async () => ({ data: sessions.filter((entry) => entry.parentID === "parent"), cursor: {} }) } },
      keymap: { layer: Keymap.createLayer, shortcuts: currentShortcuts.list },
      ui: {
        router: {
          current: route,
          navigate(destination) {
            if (destination.type !== "session") throw new Error("Expected a session destination")
            navigated.push(destination.sessionID)
            setRoute(destination)
          },
        },
      },
      theme: {
        text: { base: RGBA.fromHex("#ffffff"), muted: RGBA.fromHex("#888888") },
        background: { raised: { base: RGBA.fromHex("#111111"), high: RGBA.fromHex("#333333") } },
        border: { base: RGBA.fromHex("#444444") },
      },
    }
    source = createV2Source(context, () => sessionID, (message) => diagnostics.push(message))
    return <Footer source={source} />
  }

  const app = await testRender(() => (
    <box>
      <textarea ref={(value) => { editor = value }} focused initialValue="alpha beta" width={80} height={2} />
      <Show when={providerVisible()}>
        <Keymap.Provider config={config}>
          <Probe />
          <Show when={footerVisible()}><BoundFooter /></Show>
        </Keymap.Provider>
      </Show>
    </box>
  ), { width: 100, height: 12, kittyKeyboard: true })
  await app.renderOnce()
  return {
    app, setProviderVisible, setFooterVisible, dataListeners, navigated, diagnostics,
    editor() { if (!editor) throw new Error("Textarea was not mounted"); return editor },
    source() { if (!source) throw new Error("Footer source was not mounted"); return source },
    commands() { if (!commands) throw new Error("Keymap was not mounted"); return commands() },
    shortcuts(id: string) { if (!shortcuts) throw new Error("Keymap was not mounted"); return shortcuts(id) },
    dispatch(id: string) { if (!dispatch) throw new Error("Keymap was not mounted"); dispatch(id) },
    restoreRoute() { setRoute({ type: "session", sessionID }) },
    listenerCounts() {
      return {
        publicKeys: app.renderer.keyInput.listenerCount("keypress"),
        internalKeys: app.renderer._internalKeyInput.listenerCount("keypress"),
        focusedEditor: app.renderer.listenerCount("focused_editor"),
        focusedRenderable: app.renderer.listenerCount("focused_renderable"),
        resize: app.renderer.listenerCount("resize"),
      }
    },
  }
}

test("v2 root renders metrics without navigation commands in the real host palette", async () => {
  const fixture = await setup(undefined, "parent")
  try {
    fixture.setProviderVisible(true)
    fixture.setFooterVisible(true)
    await fixture.app.renderOnce()
    expect(fixture.app.captureCharFrame()).toContain("session $0.00")
    for (const label of ["Parent", "Prev", "Next"]) expect(fixture.app.captureCharFrame()).not.toContain(label)
    expect(fixture.commands().filter((entry) => commandIDs.some((id) => id === entry.id))).toEqual([])
    for (const id of commandIDs) fixture.dispatch(id)
    expect(fixture.navigated).toEqual([])
    expect(fixture.app.renderer.currentFocusedEditor).toBe(fixture.editor())
    expect(fixture.diagnostics).toEqual([])
  } finally {
    fixture.app.renderer.destroy()
  }
})

test("v2 footer preserves host word selection with alt+shift+left/right in the focused composer textarea", async () => {
  const fixture = await setup()
  try {
    fixture.setProviderVisible(true)
    await fixture.app.renderOnce()
    const editor = fixture.editor()
    const selectWord = async (direction: "left" | "right") => {
      editor.clearSelection()
      editor.cursorOffset = direction === "left" ? editor.plainText.length : 0
      fixture.app.mockInput.pressArrow(direction, { meta: true, shift: true })
      await fixture.app.renderOnce()
      return { text: editor.getSelectedText(), bounds: editor.getSelection(), cursor: editor.cursorOffset }
    }
    const beforeLeft = await selectWord("left")
    const beforeRight = await selectWord("right")
    expect(beforeLeft.text).toBe("beta")
    expect(beforeRight.text.length).toBeGreaterThan(0)
    const listeners = fixture.listenerCounts()
    fixture.setFooterVisible(true)
    await fixture.app.waitFor(() => fixture.source().previous.enabled() && fixture.source().next.enabled())
    await fixture.app.renderOnce()
    const afterLeft = await selectWord("left")
    const afterRight = await selectWord("right")
    expect(afterLeft).toEqual(beforeLeft)
    expect(afterRight).toEqual(beforeRight)
    expect(editor.plainText).toBe("alpha beta")
    expect(fixture.app.renderer.currentFocusedEditor).toBe(editor)
    expect(fixture.navigated).toEqual([])
    expect(fixture.listenerCounts().publicKeys).toBe(listeners.publicKeys)
    expect(fixture.listenerCounts().internalKeys).toBe(listeners.internalKeys)
    expect(fixture.app.captureCharFrame()).toContain("alpha beta")
    expect(fixture.diagnostics).toEqual([])
  } finally {
    fixture.app.renderer.destroy()
  }
})

test("native word-selection bindings loaded from a real CLI config retain editor behavior with the footer", async () => {
  const temporaryRoot = await realpath(tmpdir())
  const temporary = await realpath(await mkdtemp(join(temporaryRoot, "rich-footer-keybind-")))
  let fixture: Awaited<ReturnType<typeof setup>> | undefined
  try {
    const file = join(temporary, "cli.json")
    const overrides = {
      "input.select.word.backward": "ctrl+shift+left",
      "input.select.word.forward": "ctrl+shift+right",
    }
    await writeFile(file, JSON.stringify({ $schema: "https://opencode.ai/v2/cli.json", keybinds: overrides }), "utf8")
    // Read an isolated file, then use exactly the host's schema and resolver.
    // No synthetic command layer replaces the configured native commands.
    const decoded = effectModule.Schema.decodeUnknownSync(configModule.Info)(JSON.parse(await readFile(file, "utf8")))
    expect(decoded).toMatchObject({ keybinds: overrides })
    const config = configModule.resolve(decoded, { terminalSuspend: false, environment: {} })
    expect(config.keybinds.get("input.select.word.backward")).toMatchObject([{ key: "ctrl+shift+left" }])
    expect(config.keybinds.get("input.select.word.forward")).toMatchObject([{ key: "ctrl+shift+right" }])
    const mounted = await setup(config)
    fixture = mounted
    mounted.setProviderVisible(true)
    await mounted.app.renderOnce()
    const editor = mounted.editor()
    const selectWord = async (direction: "left" | "right") => {
      editor.clearSelection()
      editor.cursorOffset = direction === "left" ? editor.plainText.length : 0
      mounted.app.mockInput.pressArrow(direction, { ctrl: true, shift: true })
      await mounted.app.renderOnce()
      return { text: editor.getSelectedText(), bounds: editor.getSelection(), cursor: editor.cursorOffset }
    }
    const beforeLeft = await selectWord("left")
    const beforeRight = await selectWord("right")
    expect(beforeLeft.text.length).toBeGreaterThan(0)
    expect(beforeRight.text.length).toBeGreaterThan(0)
    const beforeFooter = mounted.listenerCounts()
    mounted.setFooterVisible(true)
    await mounted.app.waitFor(() => mounted.source().previous.enabled() && mounted.source().next.enabled())
    await mounted.app.renderOnce()
    expect(await selectWord("left")).toEqual(beforeLeft)
    expect(await selectWord("right")).toEqual(beforeRight)
    expect(editor.plainText).toBe("alpha beta")
    expect(mounted.app.renderer.currentFocusedEditor).toBe(editor)
    expect(mounted.navigated).toEqual([])
    expect(mounted.listenerCounts().publicKeys).toBe(beforeFooter.publicKeys)
    expect(mounted.listenerCounts().internalKeys).toBe(beforeFooter.internalKeys)
    for (const id of commandIDs) {
      const command = mounted.commands().find((entry) => entry.id === id)
      expect(command?.palette).toBe(true)
      expect(command?.bind).toBe(false)
      expect(mounted.shortcuts(id)).toEqual([])
    }
    const previous = mounted.commands().find((entry) => entry.id === commandIDs[1] && entry.palette)
    if (!previous) throw new Error("Configured native bindings removed the footer palette command")
    previous.run()
    expect(mounted.navigated).toEqual(["child-a"])
    mounted.restoreRoute()
    await mounted.app.renderOnce()
    const lines = mounted.app.captureCharFrame().split("\n")
    const y = lines.findIndex((line) => line.includes("Next"))
    if (y < 0) throw new Error("Footer next action was not rendered")
    await mounted.app.mockMouse.click(lines[y].indexOf("Next"), y)
    expect(mounted.navigated).toEqual(["child-a", "child-c"])
    expect(mounted.app.renderer.currentFocusedEditor).toBe(editor)
    expect(editor.plainText).toBe("alpha beta")
    mounted.setFooterVisible(false)
    await mounted.app.renderOnce()
    expect(mounted.listenerCounts()).toEqual(beforeFooter)
    expect(mounted.dataListeners.size).toBe(0)
    expect(mounted.diagnostics).toEqual([])
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ keybinds: overrides })
  } finally {
    fixture?.app.renderer.destroy()
    const resolved = await realpath(temporary)
    if (!resolved.startsWith(temporaryRoot + sep)) throw new Error("Keybinding fixture escaped its temporary root")
    await rm(resolved, { recursive: true, force: true })
  }
})

test("v2 commands reach the real palette/dispatch without default bindings and clean up with the owner", async () => {
  // The host's keymap is bound to renderer lifetime. Its Provider removes addons
  // on unmount but retains host key/focus subscriptions until renderer.destroy().
  // Establish that behavior without the plugin before comparing its teardown.
  const control = await setup()
  let controlBefore: ReturnType<typeof control.listenerCounts>
  let controlAfter: ReturnType<typeof control.listenerCounts>
  try {
    controlBefore = control.listenerCounts()
    control.setProviderVisible(true)
    await control.app.renderOnce()
    control.setProviderVisible(false)
    await control.app.renderOnce()
    controlAfter = control.listenerCounts()
    expect(control.dataListeners.size).toBe(0)
    expect(control.navigated).toEqual([])
  } finally {
    control.app.renderer.destroy()
  }
  const fixture = await setup()
  try {
    const beforeProvider = fixture.listenerCounts()
    expect(beforeProvider).toEqual(controlBefore)
    fixture.setProviderVisible(true)
    await fixture.app.renderOnce()
    const beforeFooter = fixture.listenerCounts()
    fixture.setFooterVisible(true)
    await fixture.app.waitFor(() => fixture.source().previous.enabled() && fixture.source().next.enabled())
    await fixture.app.renderOnce()
    expect(fixture.dataListeners.size).toBe(1)
    for (const [id, expected] of [[commandIDs[0], "parent"], [commandIDs[1], "child-a"], [commandIDs[2], "child-c"]] as const) {
      fixture.restoreRoute()
      await fixture.app.renderOnce()
      const command = fixture.commands().find((entry) => entry.id === id)
      expect(command).toBeDefined()
      expect(command?.palette).toBe(true)
      expect(command?.bind).toBe(false)
      expect(fixture.shortcuts(id)).toEqual([])
      fixture.dispatch(id)
      expect(fixture.navigated.at(-1)).toBe(expected)
    }
    fixture.restoreRoute()
    await fixture.app.renderOnce()
    const palettePrevious = fixture.commands().find((entry) => entry.id === commandIDs[1] && entry.palette)
    if (!palettePrevious) throw new Error("Previous sibling command was not available to the host palette")
    palettePrevious.run()
    expect(fixture.navigated.at(-1)).toBe("child-a")
    fixture.restoreRoute()
    fixture.setFooterVisible(false)
    await fixture.app.renderOnce()
    expect(fixture.dataListeners.size).toBe(0)
    expect(fixture.listenerCounts()).toEqual(beforeFooter)
    expect(fixture.commands().filter((entry) => commandIDs.some((id) => id === entry.id))).toEqual([])
    expect(fixture.source().parent.enabled()).toBe(false)
    expect(fixture.source().previous.enabled()).toBe(false)
    expect(fixture.source().next.enabled()).toBe(false)
    const count = fixture.navigated.length
    for (const id of commandIDs) fixture.dispatch(id)
    fixture.source().parent.run()
    fixture.source().previous.run()
    fixture.source().next.run()
    palettePrevious.run()
    expect(fixture.navigated).toHaveLength(count)
    fixture.setProviderVisible(false)
    await fixture.app.renderOnce()
    expect(fixture.listenerCounts()).toEqual(controlAfter)
    expect(fixture.app.renderer.currentFocusedEditor).toBe(fixture.editor())
    expect(fixture.editor().plainText).toBe("alpha beta")
    expect(fixture.diagnostics).toEqual([])
  } finally {
    fixture.app.renderer.destroy()
  }
})
