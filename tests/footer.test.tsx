/** @jsxImportSource @opentui/solid */
import { expect, spyOn, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal } from "solid-js"
import { Footer } from "../src/footer"
import type { FooterMessage, FooterSession, FooterSource, FooterStatus, FooterTheme, FooterTotals } from "../src/contracts"

function fixture() {
  const now = Date.now()
  const [key, setKey] = createSignal("child")
  const [session, setSession] = createSignal<FooterSession | undefined>({ id: "child", parentID: "root", agent: "build", title: "Build" })
  const [messages, setMessages] = createSignal<readonly FooterMessage[]>([
    { type: "assistant", id: "answer", tokens: { input: 100, output: 20, reasoning: 0, cacheRead: 10, cacheWrite: 0 }, cost: 0, model: { providerID: "provider", modelID: "model" }, createdAt: now - 2000, streamedAt: now - 1000, completedAt: now },
  ])
  const [status, setStatus] = createSignal<FooterStatus>("idle")
  const [totals, setTotals] = createSignal<FooterTotals>({ scope: "loaded", cost: 0, tokens: { input: 100, output: 20, reasoning: 0, cacheRead: 10, cacheWrite: 0 } })
  const [theme, setTheme] = createSignal<FooterTheme>({ text: "#ffffff", textMuted: "#888888", border: "#444444", backgroundPanel: "#111111", backgroundElement: "#333333" })
  const [enabled, setEnabled] = createSignal(true)
  const [shortcut, setShortcut] = createSignal<string | undefined>("a")
  const calls: string[] = []
  const source: FooterSource = {
    key, session, messages, status, totals, theme,
    siblings: () => [{ id: "child", parentID: "root" }],
    contextLimit: () => 1000,
    parent: { enabled, shortcut, run: () => { calls.push(`parent:${key()}`) } },
    previous: { enabled, shortcut: () => undefined, run: () => { calls.push(`previous:${key()}`) } },
    next: { enabled, shortcut: () => undefined, run: () => { calls.push(`next:${key()}`) } },
    liveTokenDeltas: false,
  }
  return { source, calls, setKey, setSession, setMessages, setStatus, setTotals, setTheme, setEnabled, setShortcut }
}

function location(frame: string, text: string) {
  const lines = frame.split("\n")
  const y = lines.findIndex((line) => line.includes(text))
  if (y < 0) throw new Error(`Missing ${text} in rendered frame:\n${frame}`)
  return { x: lines[y].indexOf(text), y }
}

test("root sessions render nothing and a reactive child appears", async () => {
  const data = fixture()
  data.setSession({ id: "root" })
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
    data.setSession({ id: "child", parentID: "root", agent: "build" })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Parent")
    expect(setup.captureCharFrame()).toContain("response")
    data.setSession(undefined)
    await setup.renderOnce()
    expect(setup.captureCharFrame().trim()).toBe("")
  } finally {
    setup.renderer.destroy()
  }
})

test("40, 80 and 120 column layouts keep all navigation visible and avoid wrapping", async () => {
  const data = fixture()
  const setup = await testRender(() => <Footer source={data.source} />, { width: 120, height: 12 })
  try {
    for (const width of [120, 80, 40]) {
      setup.resize(width, 12)
      await setup.renderOnce()
      const frame = setup.captureCharFrame()
      expect(frame).toContain("Parent")
      expect(frame).toContain("Prev")
      expect(frame).toContain("Next")
      const parent = location(frame, "Parent")
      const previous = location(frame, "Prev")
      const next = location(frame, "Next")
      expect(previous.y).toBe(parent.y)
      expect(next.y).toBe(parent.y)
      expect(next.x + 4).toBeLessThan(width)
      const content = frame.split("\n").filter((line) => line.replace(/[│ ]/g, "").trim())
      expect(content.length).toBeLessThanOrEqual(width < 60 ? 3 : width < 110 ? 2 : 1)
      expect(setup.captureSpans().cols).toBe(width)
    }
  } finally {
    setup.renderer.destroy()
  }
})

test("response usage and loaded/session cost scopes are explicit, including zero cost", async () => {
  const data = fixture()
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("response")
    expect(setup.captureCharFrame()).toContain("loaded $0.00")
    data.setTotals({ scope: "session", cost: 1.25 })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("session $1.25")
    data.setMessages([])
    data.setTotals({ scope: "loaded" })
    await setup.renderOnce()
    expect(setup.captureCharFrame()).not.toContain("response")
    expect(setup.captureCharFrame()).not.toContain("$0.00")
    expect(setup.captureCharFrame()).not.toContain("ctx")
  } finally {
    setup.renderer.destroy()
  }
})

test("theme and hover colors follow current semantic tokens", async () => {
  const data = fixture()
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    const parent = location(setup.captureCharFrame(), "Parent")
    await setup.mockMouse.moveTo(parent.x, parent.y)
    await setup.renderOnce()
    const hovered = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes("Parent"))
    expect(hovered?.bg.equals(RGBA.fromHex("#333333"))).toBe(true)
    data.setTheme({ text: "#ff0000", textMuted: "#00ff00", border: "#0000ff", backgroundPanel: "#222222", backgroundElement: "#555555" })
    await setup.renderOnce()
    const updated = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes("Parent"))
    expect(updated?.fg.equals(RGBA.fromHex("#ff0000"))).toBe(true)
    expect(updated?.bg.equals(RGBA.fromHex("#555555"))).toBe(true)
    await setup.mockMouse.moveTo(0, 0)
    await setup.renderOnce()
    const unhovered = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes("Parent"))
    expect(unhovered?.bg.equals(RGBA.fromHex("#222222"))).toBe(true)
    data.setTheme({ text: "#202020", textMuted: "#555555", border: "#bbbbbb", backgroundPanel: "#fafafa", backgroundElement: "#eeeeee" })
    await setup.renderOnce()
    const light = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes("Parent"))
    expect(light?.fg.equals(RGBA.fromHex("#202020"))).toBe(true)
    expect(light?.bg.equals(RGBA.fromHex("#fafafa"))).toBe(true)
    await setup.mockMouse.moveTo(parent.x, parent.y)
    await setup.renderOnce()
    const lightHovered = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes("Parent"))
    expect(lightHovered?.bg.equals(RGBA.fromHex("#eeeeee"))).toBe(true)
  } finally {
    setup.renderer.destroy()
  }
})

test("mouse actions follow session and enabled state while shortcut text updates", async () => {
  const data = fixture()
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    for (const label of ["Parent", "Prev", "Next"]) {
      const point = location(setup.captureCharFrame(), label)
      await setup.mockMouse.click(point.x, point.y)
    }
    expect(data.calls).toEqual(["parent:child", "previous:child", "next:child"])
    data.setKey("other")
    data.setSession({ id: "other", parentID: "root", agent: "build" })
    data.setShortcut("z")
    await setup.renderOnce()
    expect(setup.captureCharFrame()).toContain("Parent z")
    let parent = location(setup.captureCharFrame(), "Parent")
    await setup.mockMouse.click(parent.x, parent.y)
    expect(data.calls.at(-1)).toBe("parent:other")
    data.setEnabled(false)
    await setup.renderOnce()
    parent = location(setup.captureCharFrame(), "Parent")
    await setup.mockMouse.click(parent.x, parent.y)
    expect(data.calls).toHaveLength(4)
  } finally {
    setup.renderer.destroy()
  }
})

test("footer does not register keyboard bindings or take input focus on click", async () => {
  const data = fixture()
  const [input, setInput] = createSignal("")
  data.setSession({ id: "root" })
  const setup = await testRender(() => <box><input focused onInput={setInput} /><Footer source={data.source} /></box>, { width: 80, height: 12 })
  try {
    await setup.renderOnce()
    const listeners = setup.renderer.keyInput.listenerCount("keypress")
    data.setSession({ id: "child", parentID: "root", agent: "build" })
    await setup.renderOnce()
    expect(setup.renderer.keyInput.listenerCount("keypress")).toBe(listeners)
    await setup.mockInput.typeText("a")
    expect(input()).toBe("a")
    expect(data.calls).toEqual([])
    const focused = setup.renderer.currentFocusedRenderable
    const parent = location(setup.captureCharFrame(), "Parent")
    await setup.mockMouse.click(parent.x, parent.y)
    expect(setup.renderer.currentFocusedRenderable).toBe(focused)
    await setup.mockInput.typeText("b")
    expect(input()).toBe("ab")
    expect(data.calls).toEqual(["parent:child"])
  } finally {
    setup.renderer.destroy()
  }
})

test("navigation rejection is diagnosed without an unhandled promise", async () => {
  const data = fixture()
  const error = new Error("navigation unavailable")
  data.source.parent.run = () => Promise.reject(error)
  const report = spyOn(console, "error").mockImplementation(() => undefined)
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    const parent = location(setup.captureCharFrame(), "Parent")
    await setup.mockMouse.click(parent.x, parent.y)
    await Promise.resolve()
    expect(report).toHaveBeenCalledWith("[opencode-rich-footer] parent navigation failed", error)
  } finally {
    setup.renderer.destroy()
    report.mockRestore()
  }
})

test("running/retry timer clears on session switch, idle, root and owner disposal", async () => {
  const data = fixture()
  data.setStatus("running")
  const intervals = spyOn(globalThis, "setInterval")
  const clears = spyOn(globalThis, "clearInterval")
  const handles = () => intervals.mock.calls.flatMap(([callback], index) => {
    const result = intervals.mock.results[index]
    return typeof callback === "function" && callback.name === "tickFooter" && result?.type === "return" ? [result.value] : []
  })
  const setup = await testRender(() => <Footer source={data.source} />, { width: 80, height: 10 })
  try {
    await setup.renderOnce()
    expect(handles()).toHaveLength(1)
    data.setKey("second")
    data.setSession({ id: "second", parentID: "root", agent: "build" })
    await setup.renderOnce()
    expect(clears.mock.calls.map(([handle]) => handle)).toContain(handles()[0])
    const beforeIdle = handles().length
    data.setStatus("idle")
    await setup.renderOnce()
    expect(handles()).toHaveLength(beforeIdle)
    expect(clears.mock.calls.map(([handle]) => handle)).toContain(handles().at(-1))
    data.setStatus("retry")
    await setup.renderOnce()
    expect(handles()).toHaveLength(beforeIdle + 1)
    const retryHandle = handles().at(-1)
    data.setSession({ id: "root" })
    await setup.renderOnce()
    expect(clears.mock.calls.map(([handle]) => handle)).toContain(retryHandle)
    const beforeRoot = handles().length
    data.setStatus("running")
    await setup.renderOnce()
    expect(handles()).toHaveLength(beforeRoot)
    data.setSession({ id: "second", parentID: "root", agent: "build" })
    await setup.renderOnce()
    expect(handles()).toHaveLength(beforeRoot + 1)
    const lastHandle = handles().at(-1)
    setup.renderer.destroy()
    expect(clears.mock.calls.map(([handle]) => handle)).toContain(lastHandle)
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
    intervals.mockRestore()
    clears.mockRestore()
  }
})
