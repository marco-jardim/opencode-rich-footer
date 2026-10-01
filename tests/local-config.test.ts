import { describe, expect, spyOn, test } from "bun:test"
import * as filesystem from "node:fs/promises"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.env.RICH_FOOTER_ROOT!
const config = await import(pathToFileURL(path.join(process.env.RICH_FOOTER_OPERATIONAL_ROOT ?? path.join(root, "scripts"), `local-config.${process.env.RICH_FOOTER_COVERAGE_PRELOAD ? "js" : "ts"}`)).href) as typeof import("../scripts/local-config")
const target = "D:\\git\\opencode-rich-footer"

describe("personal configuration transaction", () => {
  test("removes only identified server declarations and preserves unrelated data/options/comments", () => {
    const text = '{\r\n// untouched\r\n"provider":{"token":"synthetic"},"plugin":["other",["D:\\\\git\\\\opencode-rich-footer",{"x":1}],"file:///D:/git/opencode-rich-footer",["keep",{"n":2}]],"permission":{"x":false}\r\n}'
    const result = config.removeServerRegistration(text, target)
    expect(result).toContain('// untouched\r\n"provider":{"token":"synthetic"}')
    expect(result).toContain('"permission":{"x":false}')
    expect(config.object(result)).toEqual({ provider: { token: "synthetic" }, plugin: ["other", ["keep", { n: 2 }]], permission: { x: false } })
    expect(config.removeServerRegistration(result, target)).toBe(result)
    expect(config.removeServerRegistration('{"plugin":["unrelated"]}', target)).toBe('{"plugin":["unrelated"]}')
    for (const entries of [["other", target], [target, "other"], [target]]) {
      const result = config.removeServerRegistration(JSON.stringify({ plugin: entries }), target)
      expect(config.object(result).plugin).toEqual(entries.filter((entry) => entry !== target))
    }
    const comments = '{"plugin":["other",/* keep comment */"D:\\\\git\\\\opencode-rich-footer",]}'
    expect(config.removeServerRegistration(comments, target)).toContain("/* keep comment */")
  })
  test("normalizes one enabled TUI declaration, retains plugin options and other keys", () => {
    const original = JSON.stringify({ theme: { name: "personal" }, plugins: ["other", { package: target, options: { safe: true } }, "-opencode-rich-footer", pathToFileURL(target).href] })
    const result = config.normalizeClient(original, target)
    expect(config.object(result)).toEqual({ theme: { name: "personal" }, plugins: ["other", { package: target, options: { safe: true } }] })
    expect(config.normalizeClient(result, target)).toBe(result)
    expect(() => config.normalizeClient('{"plugins":1}', target)).toThrow()
    expect(() => config.removeServerRegistration('{"plugin":{}}', target)).toThrow()
    expect(() => config.object('{"plugin":[],"plugin":[]}')).toThrow("duplicate")
    expect(() => config.object('{bad')).toThrow()
    expect(config.preferences({ sidebar: "hide", secret: "never copy" })).toEqual({ sidebar: "hide" })
  })
  test("apply is idempotent; rollback restores original bytes and original absence", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "footer config ação 日本 "))
    const server = path.join(directory, "server.json"), client = path.join(directory, "client.json"), guard = path.join(directory, "tui.json")
    const before = Buffer.from('{\r\n "plugin": []\r\n}\r\n'), after = Buffer.from('{}\n')
    try {
      await writeFile(server, before); await writeFile(guard, "preserved")
      const changes = [{ file: server, before, after }, { file: client, before: undefined, after }]
      const guards = [{ file: guard, before: Buffer.from("preserved"), after: Buffer.from("preserved") }]
      const applied = await config.applyConfiguration(changes, guards, path.join(directory, "backup"))
      expect(applied.changed).toBe(2)
      expect(await readFile(server)).toEqual(after)
      expect(await readFile(client)).toEqual(after)
      expect((await config.applyConfiguration(changes.map((item) => ({ ...item, before: after })), guards, path.join(directory, "unused"))).changed).toBe(0)
      expect(await config.restoreConfiguration(applied.manifest!)).toBe(2)
      expect(await config.restoreConfiguration(applied.manifest!)).toBe(0)
      expect(await readFile(server)).toEqual(before)
      expect(await config.optional(client)).toBeUndefined()
      expect(await readFile(guard, "utf8")).toBe("preserved")
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  test("restore compensates a failed second publication and can resume after compensation also fails", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "footer restore failure "))
    const server = path.join(directory, "server.json"), client = path.join(directory, "client.json")
    const actualRename = filesystem.rename, actualLink = filesystem.link
    try {
      await writeFile(server, "original")
      const applied = await config.applyConfiguration([{ file: server, before: Buffer.from("original"), after: Buffer.from("installed") }, { file: client, before: undefined, after: Buffer.from("client") }], [], path.join(directory, "backup"))
      const renames = spyOn(filesystem, "rename").mockImplementation(async (from, to) => {
        if (String(to) === server) throw new Error("injected locked server")
        return actualRename(from, to)
      })
      try {
        await expect(config.restoreConfiguration(applied.manifest!)).rejects.toThrow(applied.manifest!)
        expect(await readFile(server, "utf8")).toBe("installed")
        expect(await readFile(client, "utf8")).toBe("client")
        const links = spyOn(filesystem, "link").mockImplementation(async (from, to) => {
          if (String(to) === client) throw new Error("injected compensation failure")
          return actualLink(from, to)
        })
        try { await expect(config.restoreConfiguration(applied.manifest!)).rejects.toBeInstanceOf(AggregateError) }
        finally { links.mockRestore() }
        expect(await config.optional(client)).toBeUndefined()
      } finally { renames.mockRestore() }
      expect(await config.restoreConfiguration(applied.manifest!)).toBe(1)
      expect(await readFile(server, "utf8")).toBe("original")
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  test("a cleanup failure after publishing a new file is compensated and diagnosed", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "footer cleanup failure "))
    const client = path.join(directory, "client.json")
    const actualUnlink = filesystem.unlink
    const unlinks = spyOn(filesystem, "unlink").mockImplementation(async (file) => {
      if (String(file).endsWith(".tmp")) throw new Error("injected temporary cleanup failure")
      return actualUnlink(file)
    })
    try {
      await expect(config.applyConfiguration([{ file: client, before: undefined, after: Buffer.from("created") }], [], path.join(directory, "backup"))).rejects.toThrow("recovery manifest")
      expect(await config.optional(client)).toBeUndefined()
    } finally { unlinks.mockRestore(); await rm(directory, { recursive: true, force: true }) }
  })
  test("drift or corrupted backups reject before any destructive restore", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "footer config drift "))
    const file = path.join(directory, "server.json"), other = path.join(directory, "client.json")
    try {
      await writeFile(file, "new writer")
      await expect(config.applyConfiguration([{ file, before: Buffer.from("old"), after: Buffer.from("ours") }], [], path.join(directory, "no-backup"))).rejects.toThrow("drift")
      const receipt = await config.applyConfiguration([{ file, before: Buffer.from("new writer"), after: Buffer.from("ours") }, { file: other, before: undefined, after: Buffer.from("ours") }], [], path.join(directory, "backup"))
      await writeFile(other, "user changed")
      await expect(config.restoreConfiguration(receipt.manifest!)).rejects.toThrow("drift")
      expect(await readFile(file, "utf8")).toBe("ours")
      await writeFile(other, "ours")
      await writeFile(path.join(directory, "backup/0.before"), "corrupt")
      await expect(config.restoreConfiguration(receipt.manifest!)).rejects.toThrow("integrity")
      expect(await readFile(file, "utf8")).toBe("ours")
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
