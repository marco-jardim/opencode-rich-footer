import { createHash, randomUUID } from "node:crypto"
import { link, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createScanner, SyntaxKind, findNodeAtLocation, modify, applyEdits, parse, parseTree, type ParseError } from "jsonc-parser"

export const preferenceKeys = ["theme", "theme_mode_lock", "attention_sound_pack", "diff_viewer_view", "thinking_mode", "thinking_visibility", "diff_wrap_mode", "diff_viewer_show_file_tree", "diff_viewer_single_patch", "terminal_title_enabled", "file_context_enabled", "paste_summary_enabled", "sidebar", "scrollbar_visible", "exploration_grouping", "animations_enabled"] as const
export type Snapshot = { file: string; before: Buffer | undefined; after: Buffer | undefined }
type ReceiptFile = { file: string; before: string | null; after: string | null; backup: string | null }
export type Receipt = { version: 1; files: ReceiptFile[] }

export function digest(value: Buffer | undefined) { return value === undefined ? null : createHash("sha256").update(value).digest("hex") }
export async function optional(file: string): Promise<Buffer | undefined> {
  try { return await readFile(file) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return undefined }
}
export function object(text: string): Record<string, unknown> {
  const errors: ParseError[] = []
  const result: unknown = parse(text, errors, { allowTrailingComma: true })
  if (errors.length || !result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid configuration object")
  const tree = parseTree(text)
  const keys = tree?.children?.map((item) => item.children?.[0]?.value) ?? []
  if (new Set(keys).size !== keys.length) throw new Error("Ambiguous duplicate configuration keys")
  return result as Record<string, unknown>
}
function spec(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined
  if (value && typeof value === "object" && "package" in value && typeof value.package === "string") return value.package
}
function matches(value: unknown, target: string, named = false): boolean {
  const original = spec(value)
  if (!original) return false
  const valuePath = original.startsWith("-") ? original.slice(1) : original
  if (named && valuePath === "opencode-rich-footer") return true
  let candidate = valuePath
  if (candidate.startsWith("file:")) {
    try { candidate = fileURLToPath(candidate) } catch { return false }
  }
  return path.isAbsolute(candidate) && path.normalize(candidate).toLowerCase() === path.normalize(target).toLowerCase()
}
export function removeServerRegistration(text: string, target: string): string {
  const value = object(text)
  if (value.plugin === undefined) return text
  if (!Array.isArray(value.plugin)) throw new Error("Server plugin must be an array")
  for (let index = value.plugin.length - 1; index >= 0; index--) {
    if (!matches(value.plugin[index], target)) continue
    const array = findNodeAtLocation(parseTree(text)!, ["plugin"])
    const node = array?.children?.[index]
    if (!array || !node) throw new Error("Missing server plugin element")
    const previous = array.children?.[index - 1]
    const next = array.children?.[index + 1]
    const start = previous && !next ? previous.offset + previous.length : node.offset + node.length
    const end = next?.offset ?? (previous ? node.offset : array.offset + array.length)
    const scanner = createScanner(text, false)
    scanner.setPosition(start)
    let comma: number | undefined
    while (scanner.scan() !== SyntaxKind.EOF && scanner.getTokenOffset() < end) {
      if (scanner.getToken() === SyntaxKind.CommaToken) { comma = scanner.getTokenOffset(); break }
    }
    const ranges = [{ offset: node.offset, length: node.length }, ...(comma === undefined ? [] : [{ offset: comma, length: 1 }])]
    for (const range of ranges.sort((a, b) => b.offset - a.offset)) text = text.slice(0, range.offset) + text.slice(range.offset + range.length)
  }
  object(text)
  return text
}
export function normalizeClient(text: string, target: string): string {
  const value = object(text)
  if (value.plugins !== undefined && !Array.isArray(value.plugins)) throw new Error("Client plugins must be an array")
  const plugins = (value.plugins ?? []) as unknown[]
  const current = plugins.filter((entry) => matches(entry, target, true))
  if (current.length === 1 && spec(current[0]) === target) return text
  const preserved = current.find((entry) => typeof entry === "object" && !Array.isArray(entry))
  const footer = preserved && typeof preserved === "object" ? { ...preserved, package: target } : target
  const next = plugins.filter((entry) => !matches(entry, target, true))
  next.push(footer)
  return applyEdits(text, modify(text, ["plugins"], next, { formattingOptions: { tabSize: 2, insertSpaces: true } }))
}
export function preferences(value: Record<string, unknown>) {
  return Object.fromEntries(preferenceKeys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]))
}
async function unchanged(snapshot: Snapshot) {
  if (digest(await optional(snapshot.file)) !== digest(snapshot.before)) throw new Error(`Configuration drift: ${snapshot.file}`)
}
class PublicationError extends Error {
  constructor(readonly committed: boolean, file: string, readonly errors: unknown[]) {
    super(`Configuration publication failed: ${file}`, { cause: new AggregateError(errors) })
  }
}
async function publish(snapshot: Snapshot) {
  await unchanged(snapshot)
  if (snapshot.after === undefined) { await unlink(snapshot.file); return }
  const temporary = `${snapshot.file}.rich-footer-${randomUUID()}.tmp`
  await writeFile(temporary, snapshot.after, { flag: "wx", mode: 0o600 })
  let committed = false
  const errors: unknown[] = []
  try {
    await unchanged(snapshot)
    // An absent destination must never overwrite a file created concurrently.
    if (snapshot.before === undefined) await link(temporary, snapshot.file)
    else await rename(temporary, snapshot.file)
    committed = true
  } catch (error) {
    errors.push(error)
  } finally {
    try { await unlink(temporary) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") errors.push(error) }
  }
  if (errors.length) throw new PublicationError(committed, snapshot.file, errors)
}
async function commitAll(snapshots: Snapshot[], manifest: string) {
  const published: Snapshot[] = []
  try {
    for (const snapshot of snapshots) {
      try { await publish(snapshot); published.push(snapshot) }
      catch (error) { if (error instanceof PublicationError && error.committed) published.push(snapshot); throw error }
    }
  } catch (original) {
    const errors: unknown[] = [original]
    for (const snapshot of published.reverse()) {
      try { await publish({ file: snapshot.file, before: snapshot.after, after: snapshot.before }) }
      catch (error) { errors.push(error) }
    }
    throw new AggregateError(errors, `Configuration transaction failed; recovery manifest: ${manifest}`)
  }
}
export async function applyConfiguration(snapshots: Snapshot[], guards: Snapshot[], backupDirectory: string) {
  const changes = snapshots.filter((item) => digest(item.before) !== digest(item.after))
  for (const snapshot of [...snapshots, ...guards]) await unchanged(snapshot)
  if (!changes.length) return { changed: 0, manifest: undefined }
  await mkdir(backupDirectory, { recursive: false, mode: 0o700 })
  const receipt: Receipt = { version: 1, files: [] }
  for (const [index, snapshot] of changes.entries()) {
    const backup = snapshot.before === undefined ? null : path.join(backupDirectory, `${index}.before`)
    if (backup) await writeFile(backup, snapshot.before!, { flag: "wx", mode: 0o600 })
    receipt.files.push({ file: snapshot.file, before: digest(snapshot.before), after: digest(snapshot.after), backup })
  }
  const manifest = path.join(backupDirectory, "manifest.json")
  await writeFile(manifest, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 })
  for (const snapshot of [...snapshots, ...guards]) await unchanged(snapshot)
  await commitAll(changes, manifest)
  return { changed: changes.length, manifest }
}
export async function restoreConfiguration(manifest: string) {
  const value = object(await readFile(manifest, "utf8"))
  if (value.version !== 1 || !Array.isArray(value.files)) throw new Error("Invalid backup manifest")
  const snapshots: Snapshot[] = []
  for (const item of value.files as ReceiptFile[]) {
    if (!path.isAbsolute(item.file) || (item.backup !== null && path.dirname(item.backup) !== path.dirname(manifest))) throw new Error("Invalid backup paths")
    const after = item.backup === null ? undefined : await readFile(item.backup)
    if (digest(after) !== item.before) throw new Error(`Backup integrity mismatch: ${item.file}`)
    const before = await optional(item.file)
    // A previous restore may have completed this item before an IO failure.
    // Only the exact original state is accepted, never arbitrary user changes.
    if (digest(before) === item.before) continue
    if (digest(before) !== item.after) throw new Error(`Configuration drift: ${item.file}`)
    snapshots.push({ file: item.file, before, after })
  }
  for (const snapshot of snapshots) await unchanged(snapshot)
  await commitAll(snapshots.reverse(), manifest)
  return snapshots.length
}
