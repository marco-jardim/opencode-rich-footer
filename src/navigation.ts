import type { FooterSession } from "./contracts"

/** Direct siblings have one parent; creation order stays stable during updates. */
export function directSiblings(current: FooterSession | undefined, sessions: readonly FooterSession[]) {
  if (!current?.parentID) return undefined
  const siblings = new Map(sessions.filter((session) => session.parentID === current.parentID).map((session) => [session.id, session]))
  return [...siblings.values()]
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
  if (index < 0 || siblings.length < 2) return undefined
  return siblings[(index + direction + siblings.length) % siblings.length]
}
