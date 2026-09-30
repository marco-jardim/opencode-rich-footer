import type { FooterSession } from "./contracts"

/** Direct siblings have one parent; creation order stays stable during updates. */
export function directSiblings(current: FooterSession | undefined, sessions: readonly FooterSession[]) {
  if (!current?.parentID) return undefined
  return sessions
    .filter((session) => session.parentID === current.parentID)
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function siblingTarget(
  current: FooterSession | undefined,
  sessions: readonly FooterSession[] | undefined,
  direction: -1 | 1,
) {
  if (!current?.parentID || !sessions) return undefined
  const siblings = directSiblings(current, sessions) ?? []
  const index = siblings.findIndex((session) => session.id === current.id)
  if (index < 0) return undefined
  return siblings[index + direction]
}
