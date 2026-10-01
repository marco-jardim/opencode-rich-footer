import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { hosts } from "./hosts"
import { applyConfiguration, normalizeClient, object, optional, preferences, removeServerRegistration, restoreConfiguration, type Snapshot } from "./local-config"

/** Import the pinned host's real schema and pure migration, without initializing services. */
export async function hostMigration() {
  const runtime = path.join(hosts.v2.root, "packages/cli")
  const effect = await import(pathToFileURL(Bun.resolveSync("effect", runtime)).href) as {
    Schema: { decodeUnknownSync(schema: unknown): (value: unknown) => unknown }
  }
  const legacy = await import(pathToFileURL(Bun.resolveSync("@opencode/tui/config/v1", runtime)).href) as { TuiConfigV1: { Info: unknown } }
  const schema = await import(pathToFileURL(path.join(runtime, "src/config/schema.ts")).href) as { Info: unknown; SchemaURL: string }
  const migration = await import(pathToFileURL(path.join(runtime, "src/config/migrate.ts")).href) as {
    migrateV1(legacy: Record<string, unknown>, kv: Record<string, unknown>): Record<string, unknown>
  }
  return {
    schema: schema.SchemaURL,
    validate(value: unknown) { effect.Schema.decodeUnknownSync(schema.Info)(value) },
    migrate(tui: Record<string, unknown>, kv: Record<string, unknown>) {
      const decoded = effect.Schema.decodeUnknownSync(legacy.TuiConfigV1.Info)(tui)
      const result = migration.migrateV1(decoded as Record<string, unknown>, preferences(kv))
      effect.Schema.decodeUnknownSync(schema.Info)(result)
      return result
    },
  }
}

export async function prepareConfiguration(configDirectory: string, stateDirectory: string, plugin: string) {
  if (![configDirectory, stateDirectory, plugin].every((item) => path.isAbsolute(item))) throw new Error("Configuration paths must be absolute")
  const files = {
    server: path.join(configDirectory, "opencode.json"), tui: path.join(configDirectory, "tui.json"),
    client: path.join(configDirectory, "cli.json"), kv: path.join(stateDirectory, "kv.json"),
  }
  const [server, tui, client, kv] = await Promise.all([files.server, files.tui, files.client, files.kv].map(optional))
  if (!tui) throw new Error("The existing v1 TUI configuration is required")
  const host = await hostMigration()
  const draft = client?.toString("utf8") ?? JSON.stringify({ $schema: host.schema, ...host.migrate(object(tui.toString("utf8")), kv ? object(kv.toString("utf8")) : {}) }, null, 2) + "\n"
  const after = normalizeClient(draft, plugin)
  host.validate(object(after))
  const snapshots: Snapshot[] = [
    { file: files.server, before: server, after: server === undefined ? undefined : Buffer.from(removeServerRegistration(server.toString("utf8"), plugin)) },
    { file: files.client, before: client, after: Buffer.from(after) },
  ]
  const guards: Snapshot[] = [{ file: files.tui, before: tui, after: tui }, { file: files.kv, before: kv, after: kv }]
  return { snapshots, guards }
}

if (import.meta.main) {
  // Host migration is pinned to the same Bun runtime as the supported v2 host.
  if (process.versions.bun !== "1.4.2") {
    if (process.env.RICH_FOOTER_CONFIG_RELAUNCHED) throw new Error("Configuration runtime relaunch limit reached")
    const probe = Bun.spawnSync([hosts.v2.bun, "--version"], { stdout: "pipe", stderr: "pipe" })
    if (probe.exitCode || probe.stdout.toString().trim() !== "1.4.2") throw new Error("Configuration migration requires verified Bun 1.4.2")
    const preload = process.env.RICH_FOOTER_COVERAGE_PRELOAD
    const result = Bun.spawnSync([hosts.v2.bun, ...(preload ? ["--preload", preload] : []), fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdout: "inherit", stderr: "inherit", env: { ...process.env, RICH_FOOTER_CONFIG_RELAUNCHED: "1" } })
    process.exit(result.exitCode)
  }
  function option(name: string) {
    const index = process.argv.indexOf(name)
    const value = index >= 0 ? process.argv[index + 1] : undefined
    if (!value || value.startsWith("--") || !path.isAbsolute(value)) throw new Error(`Required absolute path: ${name}`)
    return value
  }
  if (process.argv.includes("--restore")) {
    console.log(JSON.stringify({ restored: await restoreConfiguration(option("--restore")) }))
  } else {
    const prepared = await prepareConfiguration(option("--config-dir"), option("--state-dir"), option("--plugin"))
    if (!process.argv.includes("--apply")) console.log("Validated configuration; use --apply and --backup-dir to persist with backup.")
    else console.log(JSON.stringify(await applyConfiguration(prepared.snapshots, prepared.guards, option("--backup-dir"))))
  }
}
