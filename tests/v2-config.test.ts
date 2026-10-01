import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.env.RICH_FOOTER_ROOT!
const operations = process.env.RICH_FOOTER_OPERATIONAL_ROOT ?? path.join(root, "scripts")
const extension = process.env.RICH_FOOTER_COVERAGE_PRELOAD ? "js" : "ts"
const installerPath = path.join(operations, `configure-local.${extension}`)
const installer = await import(pathToFileURL(installerPath).href) as typeof import("../scripts/configure-local")
const transaction = await import(pathToFileURL(path.join(operations, `local-config.${extension}`)).href) as typeof import("../scripts/local-config")
const plugin = "D:\\git\\opencode-rich-footer"

test("real v2 migration preserves preference precedence, other plugins and options; unknown KV is excluded", async () => {
  const host = await installer.hostMigration()
  const result = host.migrate({ plugin: [[plugin, { mode: "personal" }], "other"], theme: "legacy" }, {
    theme: "kv", thinking_mode: "hide", thinking_visibility: true, sidebar: "hide", animations_enabled: false,
    secret: "never migrate", unrelated: { apiKey: "synthetic" },
  })
  expect(result).toEqual({ plugins: [{ package: plugin, options: { mode: "personal" } }, "other"], theme: { name: "legacy" }, session: { sidebar: "hide", thinking: "hide" }, animations: false })
  expect(() => host.migrate({ mouse: "invalid" }, {})).toThrow()
  expect(() => host.migrate({}, { animations_enabled: "invalid" })).toThrow()
})

test("sandbox install, real config service read and byte-exact rollback; existing client preferences survive", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "footer migração 日本 "))
  const config = path.join(directory, "config"), state = path.join(directory, "state")
  await mkdir(config); await mkdir(state)
  const tui = '{\r\n"plugin":["D:\\\\git\\\\opencode-rich-footer"],"theme":"legacy"\r\n}\r\n'
  const kv = '{"thinking_mode":"hide","animations_enabled":false,"private":"synthetic"}'
  const server = '{"plugin":["other","D:\\\\git\\\\opencode-rich-footer"],"provider":{"unchanged":true}}\n'
  try {
    await writeFile(path.join(config, "tui.json"), tui)
    await writeFile(path.join(state, "kv.json"), kv)
    await writeFile(path.join(config, "opencode.json"), server)
    const prepared = await installer.prepareConfiguration(config, state, plugin)
    const applied = await transaction.applyConfiguration(prepared.snapshots, prepared.guards, path.join(directory, "backup"))
    expect(applied.changed).toBe(2)
    expect(await readFile(path.join(config, "tui.json"), "utf8")).toBe(tui)
    expect(await readFile(path.join(state, "kv.json"), "utf8")).toBe(kv)
    const runtime = path.join(process.env.RICH_FOOTER_HOST!, "packages/cli")
    const globals = Object.fromEntries(["home", "data", "cache", "config", "state", "tmp", "bin", "log", "repos"].map((key) => [key, key === "config" ? config : key === "state" ? state : path.join(directory, key)]))
    const code = `
      const {Effect} = await import(${JSON.stringify(pathToFileURL(Bun.resolveSync("effect", runtime)).href)});
      const {NodeFileSystem} = await import(${JSON.stringify(pathToFileURL(Bun.resolveSync("@effect/platform-node", runtime)).href)});
      const {Global} = await import(${JSON.stringify(pathToFileURL(Bun.resolveSync("@opencode/util/global", runtime)).href)});
      const Config = await import(${JSON.stringify(pathToFileURL(path.join(runtime, "src/config/config.ts")).href)});
      const result = await Effect.runPromise(Effect.gen(function*(){const service=yield* Config.Service;return yield* service.get()}).pipe(Effect.provide(Config.layer),Effect.provide(Global.layerWith(${JSON.stringify(globals)})),Effect.provide(NodeFileSystem.layer)));
      console.log(JSON.stringify(result));
    `
    const read = Bun.spawnSync([process.execPath, "-e", code], { cwd: runtime, env: process.env, stdout: "pipe", stderr: "pipe" })
    expect(read.exitCode).toBe(0)
    const loaded = JSON.parse(read.stdout.toString())
    expect(loaded.plugins).toEqual([plugin])
    expect(loaded.theme).toEqual({ name: "legacy" })
    expect(loaded.session).toEqual({ thinking: "hide" })
    expect(loaded.animations).toBe(false)
    expect(loaded.private).toBeUndefined()
    const second = await installer.prepareConfiguration(config, state, plugin)
    expect((await transaction.applyConfiguration(second.snapshots, second.guards, path.join(directory, "unused"))).changed).toBe(0)
    await transaction.restoreConfiguration(applied.manifest!)
    expect(await readFile(path.join(config, "opencode.json"), "utf8")).toBe(server)
    expect(await transaction.optional(path.join(config, "cli.json"))).toBeUndefined()
    const existing = '{"theme":{"name":"v2-personal"},"plugins":["other"],"mouse":false}'
    await writeFile(path.join(config, "cli.json"), existing)
    const preserve = await installer.prepareConfiguration(config, state, plugin)
    expect(JSON.parse(preserve.snapshots[1].after!.toString())).toEqual({ theme: { name: "v2-personal" }, plugins: ["other", plugin], mouse: false })
    await writeFile(path.join(config, "cli.json"), '{"mouse":true}')
    await expect(transaction.applyConfiguration(preserve.snapshots, preserve.guards, path.join(directory, "blocked"))).rejects.toThrow("drift")
    expect(await readFile(path.join(config, "opencode.json"), "utf8")).toBe(server)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("CLI dry-run/apply/restore and runtime errors terminate within a bound without unauthorized writes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "footer CLI ação "))
  const config = path.join(directory, "config"), state = path.join(directory, "state")
  await mkdir(config); await mkdir(state)
  const server = JSON.stringify({ plugin: [plugin, "other"] })
  await writeFile(path.join(config, "tui.json"), JSON.stringify({ plugin: [plugin] }))
  await writeFile(path.join(config, "opencode.json"), server)
  const args = ["--config-dir", config, "--state-dir", state, "--plugin", plugin]
  const preload = process.env.RICH_FOOTER_COVERAGE_PRELOAD
  const v1 = process.env.RICH_FOOTER_V1_BUN ?? "C:/Users/Marquinho/.bun/bin/bun.exe"
  function invoke(options: string[], bun = process.execPath, env: Record<string, string | undefined> = {}) {
    return Bun.spawnSync([bun, ...(preload ? ["--preload", preload] : []), installerPath, ...options], {
      cwd: root, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe", timeout: 10_000,
    })
  }
  try {
    const dry = invoke(args, v1)
    if (dry.exitCode) throw new Error(dry.stderr.toString())
    expect(dry.stdout.toString()).toContain("Validated configuration")
    expect(await transaction.optional(path.join(config, "cli.json"))).toBeUndefined()
    expect(await readFile(path.join(config, "opencode.json"), "utf8")).toBe(server)
    for (const override of [
      { RICH_FOOTER_V2_BUN: v1 },
      { RICH_FOOTER_V2_BUN: path.join(directory, "missing-bun.exe") },
      { RICH_FOOTER_CONFIG_RELAUNCHED: "1" },
    ]) {
      const failed = invoke(args, v1, override)
      expect(failed.exitCode).not.toBe(0)
      expect(failed.stderr.toString().length).toBeGreaterThan(0)
      expect(await transaction.optional(path.join(config, "cli.json"))).toBeUndefined()
      expect(await readFile(path.join(config, "opencode.json"), "utf8")).toBe(server)
    }
    expect(invoke([]).exitCode).not.toBe(0)
    expect(invoke(["--config-dir", "relative"]).exitCode).not.toBe(0)
    expect(invoke([...args, "--apply", "--backup-dir"]).exitCode).not.toBe(0)
    const backup = path.join(directory, "private-backup")
    const applied = invoke([...args, "--apply", "--backup-dir", backup])
    if (applied.exitCode) throw new Error(applied.stderr.toString())
    const receipt = JSON.parse(applied.stdout.toString())
    expect(receipt.changed).toBe(2)
    const restored = invoke(["--restore", receipt.manifest])
    if (restored.exitCode) throw new Error(restored.stderr.toString())
    expect(JSON.parse(restored.stdout.toString()).restored).toBe(2)
    expect(await transaction.optional(path.join(config, "cli.json"))).toBeUndefined()
    expect(await readFile(path.join(config, "opencode.json"), "utf8")).toBe(server)
    await expect(installer.prepareConfiguration("relative", state, plugin)).rejects.toThrow("absolute")
    await expect(installer.prepareConfiguration(state, state, plugin)).rejects.toThrow("required")
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 60_000)
