import type { FooterAssistant, FooterMetrics, FooterSource, FooterTokens } from "./contracts"

export function nonnegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined
}

function sum(values: readonly (number | undefined)[]): number | undefined {
  if (values.some((value) => nonnegative(value) === undefined)) return undefined
  const total = values.reduce<number>((result, value) => result + value!, 0)
  return nonnegative(total)
}

export function outputTokens(tokens: FooterTokens | undefined) {
  return tokens && sum([tokens.output, tokens.reasoning])
}

function inputTokens(tokens: FooterTokens) {
  return sum([tokens.input, tokens.cacheRead, tokens.cacheWrite])
}

export function formatTokens(value: number): string {
  const n = nonnegative(value)
  if (n === undefined) return "—"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(Math.round(n))
}

export function deriveMetrics(source: FooterSource): FooterMetrics {
  const session = source.session()
  const name = session?.agent || session?.title?.match(/@([\w-]+) subagent/i)?.[1]
  const label = name ? name[0].toUpperCase() + name.slice(1) : session && !session.parentID ? "Session" : "Subagent"
  const siblings = source.siblings()
  const index = siblings?.findIndex((item) => item.id === session?.id) ?? -1
  const totals = source.totals()
  let last: FooterAssistant | undefined
  let used: FooterAssistant | undefined
  for (const message of source.messages()) {
    if (message.type === "compaction") {
      if (message.completed) { used = undefined; last = undefined }
      continue
    }
    last = message
    if (message.tokens && Object.values(message.tokens).some((value) => (nonnegative(value) ?? 0) > 0)) used = message
  }
  const tokens = used?.tokens
  const input = tokens && inputTokens(tokens)
  const output = outputTokens(tokens)
  const contextUsed = tokens && sum([input, output])
  const rawLimit = used?.model && nonnegative(source.contextLimit(used.model))
  const limit = rawLimit && rawLimit > 0 ? rawLimit : undefined
  const denominator = totals.tokens && inputTokens(totals.tokens)
  const read = nonnegative(totals.tokens?.cacheRead)
  return {
    label,
    position: siblings && index >= 0 ? `${index + 1} of ${siblings.length}` : undefined,
    response: tokens ? { input, output, cacheRead: nonnegative(tokens.cacheRead) } : undefined,
    context: contextUsed === undefined ? undefined : {
      used: contextUsed,
      limit,
      percent: limit ? Math.min(100, Math.round(contextUsed / limit * 100)) : undefined,
    },
    cachePercent: denominator && read !== undefined ? Math.min(100, Math.round(read / denominator * 100)) : undefined,
    cost: nonnegative(totals.cost),
    scope: totals.scope,
    last,
  }
}
