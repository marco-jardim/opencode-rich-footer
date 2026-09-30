import { describe, expect, test } from "bun:test"
import type { FooterAssistant, FooterSource, FooterTokens } from "../src/contracts"
import { deriveMetrics, formatTokens, nonnegative, outputTokens } from "../src/metrics"
import { FooterClock } from "../src/timing"
import { id, requireBun } from "../src/tui"

const tokens: FooterTokens = { input: 10, output: 20, reasoning: 5, cacheRead: 30, cacheWrite: 40 }
function assistant(overrides: Partial<FooterAssistant> = {}): FooterAssistant {
  return { type: "assistant", id: "a", tokens, model: { providerID: "p", modelID: "m" }, createdAt: 1_000, streamedAt: 2_000, ...overrides }
}
function source(overrides: Partial<FooterSource> = {}): FooterSource {
  const action = { enabled: () => false, shortcut: () => undefined, run() {} }
  return {
    key: () => "location/child", session: () => ({ id: "child", parentID: "root", title: "@test-agent subagent" }),
    messages: () => [assistant()], status: () => "idle", totals: () => ({ tokens, cost: 0, scope: "session" }),
    siblings: () => [{ id: "child", parentID: "root" }], contextLimit: () => 200,
    theme: () => ({ text: "#ffffff", textMuted: "#999999", border: "#555555", backgroundPanel: "#000000", backgroundElement: "#111111" }),
    parent: action, previous: action, next: action, liveTokenDeltas: false, ...overrides,
  }
}

describe("metrics", () => {
  test("preserves session totals, response values, cache denominator and identity", () => {
    const value = deriveMetrics(source())
    expect(value).toMatchObject({ label: "Test-agent", position: "1 of 1", cost: 0, scope: "session", cachePercent: 38,
      response: { input: 80, output: 25, cacheRead: 30 }, context: { used: 105, limit: 200, percent: 53 } })
  })
  test("missing, invalid and zero totals never become invented data", () => {
    const value = deriveMetrics(source({ session: () => undefined, messages: () => [], siblings: () => undefined,
      totals: () => ({ cost: NaN, tokens: { input: 0, cacheRead: 0, cacheWrite: 0 }, scope: "loaded" }) }))
    expect(value).toMatchObject({ label: "Subagent", scope: "loaded" })
    for (const key of ["position", "response", "context", "cachePercent", "cost", "last"] as const) expect(value[key]).toBeUndefined()
    for (const n of [NaN, Infinity, -1, undefined]) expect(nonnegative(n)).toBeUndefined()
    expect(outputTokens({ output: 0 })).toBeUndefined()
  })
  test("cache-only input uses both cache reads and writes without fresh input", () => {
    const cached = { input: 0, output: 0, reasoning: 1, cacheRead: 30, cacheWrite: 70 }
    const value = deriveMetrics(source({
      messages: () => [assistant({ tokens: cached })],
      totals: () => ({ tokens: cached, cost: 0, scope: "loaded" }),
    }))
    expect(value.cachePercent).toBe(30)
    expect(value.response?.input).toBe(100)
    expect(value.scope).toBe("loaded")
    expect(deriveMetrics(source({ totals: () => ({ tokens: { ...cached, cacheWrite: 0 }, scope: "session" }) })).cachePercent).toBe(100)
  })
  test("reasoning-only, provider/model lookup, unknown limit and incomplete tokens", () => {
    let lookup = ""
    const value = deriveMetrics(source({ messages: () => [assistant({ tokens: { ...tokens, output: 0 } })], contextLimit: (m) => { lookup = m.providerID + "/" + m.modelID; return 0 } }))
    expect(lookup).toBe("p/m")
    expect(value.response?.output).toBe(5)
    expect(value.context?.limit).toBeUndefined()
    expect(deriveMetrics(source({ messages: () => [assistant({ tokens: { reasoning: 7 } })] })).context).toBeUndefined()
    expect(deriveMetrics(source({ contextLimit: () => 1 })).context?.percent).toBe(100)
  })
  test("completed compaction invalidates context; pending compaction preserves it; pagination cannot change totals", () => {
    const pending = { type: "compaction" as const, id: "compact", completed: false }
    expect(deriveMetrics(source({ messages: () => [assistant(), pending] })).context?.used).toBe(105)
    expect(deriveMetrics(source({ messages: () => [assistant(), { ...pending, completed: true }] })).context).toBeUndefined()
    const after = deriveMetrics(source({ messages: () => [assistant(), { ...pending, completed: true }, assistant({ id: "new" })] }))
    expect(after.last?.id).toBe("new")
    expect(after.cost).toBe(0)
    expect(deriveMetrics(source({ messages: () => [] })).cachePercent).toBe(after.cachePercent)
  })
  test("labels and position require real session membership", () => {
    expect(deriveMetrics(source({ session: () => ({ id: "absent", agent: "Explorer" }) })).label).toBe("Explorer")
    expect(deriveMetrics(source({ session: () => ({ id: "absent", title: "other" }) })).position).toBeUndefined()
    expect(deriveMetrics(source({ messages: () => [assistant({ model: undefined })] })).context?.limit).toBeUndefined()
    expect(deriveMetrics(source({ messages: () => [assistant({ tokens: undefined })] })).response).toBeUndefined()
    expect(deriveMetrics(source({ messages: () => [assistant({ tokens: { ...tokens, input: Infinity } })] })).context).toBeUndefined()
  })
  test("formatting handles thresholds and invalid data", () => {
    expect([0, 999, 1000, 1250, 1_000_000, 1_250_000, NaN].map(formatTokens)).toEqual(["0", "999", "1k", "1.3k", "1M", "1.3M", "—"])
  })
})

describe("clock", () => {
  test("batch counts are approximate only with valid streaming boundaries", () => {
    const clock = new FooterClock()
    expect(clock.update("s", "running", assistant(), 1500, false).tps).toEqual({ value: 25, live: false })
    for (const times of [{ streamedAt: undefined }, { streamedAt: 1000 }, { streamedAt: 900 }, { createdAt: undefined }, { streamedAt: NaN }]) {
      expect(clock.update("s", "idle", assistant(times), 2000, false).tps).toBeUndefined()
    }
    expect(clock.update("s", "idle", assistant({ tokens: undefined }), 2000, false).tps).toBeUndefined()
  })
  test("elapsed resets per run and session, retry does not restart, invalid clock ignored", () => {
    const clock = new FooterClock()
    expect(clock.update("s", "running", assistant(), 2000, false).elapsed).toBe(1)
    expect(clock.update("s", "retry", assistant(), 4000, false).elapsed).toBe(3)
    expect(clock.update("s", "idle", assistant(), 5000, false).elapsed).toBe(4)
    expect(clock.update("s", "idle", assistant(), 9000, false).elapsed).toBe(4)
    expect(clock.update("s", "running", assistant({ completedAt: 5000 }), 10000, false).elapsed).toBe(0)
    expect(clock.update("new", "idle", undefined, 11000, false).elapsed).toBeUndefined()
    expect(clock.update("new", "running", undefined, 12000, false).elapsed).toBe(0)
    expect(clock.update("new", "running", undefined, NaN, false).elapsed).toBe(0)
    expect(clock.update("new", undefined, undefined, 15000, false).elapsed).toBeUndefined()
  })
  test("live samples start with observed baseline and reset on message/count regression", () => {
    const clock = new FooterClock()
    const message = (output: number, id = "a") => assistant({ id, tokens: { output, reasoning: 0 } })
    expect(clock.update("s", "running", message(100), 1000, true).tps).toBeUndefined()
    expect(clock.update("s", "running", message(110), 2000, true).tps).toEqual({ value: 10, live: true })
    expect(clock.update("s", "running", message(130), 4000, true).tps).toEqual({ value: 10, live: true })
    expect(clock.update("s", "idle", message(130), 5000, true).tps).toEqual({ value: 10, live: false })
    expect(clock.update("s", "running", message(500, "b"), 6000, true).tps).toBeUndefined()
    expect(clock.update("s", "running", message(1, "b"), 7000, true).tps).toBeUndefined()
    expect(clock.update("s", "running", message(1, "b"), 8000, true).tps).toBeUndefined()
    for (let i = 1; i <= 122; i++) clock.update("s", "running", message(i + 1, "b"), 8000 + i * 1000, true)
    expect(clock.update("s", "idle", message(123, "b"), 132000, true).tps).toEqual({ value: 1, live: false })
    clock.reset()
    expect(clock.update("s", "running", undefined, 0, true).elapsed).toBe(0)
  })
})

test("facade identifies the plugin and rejects unsupported runtime before UI imports", () => {
  expect(id).toBe("opencode-rich-footer")
  expect(() => requireBun(null)).toThrow("Bun TUI host")
  expect(() => requireBun({})).not.toThrow()
})
