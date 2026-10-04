import { cp, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { hosts, root } from "./hosts"
import { createSandbox } from "./sandbox"

const targetFlag = process.argv.indexOf("--target")
const requested = targetFlag < 0 ? root : process.argv[targetFlag + 1]
if (!requested || !path.isAbsolute(requested)) throw new Error("--target requires an absolute installed directory")
const target = await realpath(requested)
const selected = process.argv.find((argument) => argument === "--v1" || argument === "--v2")?.slice(2)
const hash = new Bun.CryptoHasher("sha256")
async function fingerprint(directory: string) {
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, item.name)
    if (item.isDirectory()) await fingerprint(file)
    else if (item.name.endsWith(".js")) { hash.update(path.relative(target, file)); hash.update(await readFile(file)) }
  }
}
hash.update(await readFile(path.join(target, "package.json")))
hash.update(await readFile(path.join(target, "tui.js")))
await fingerprint(path.join(target, "dist"))
const git = Bun.spawnSync(["git", "-C", target, "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" })
console.log(`Installed target: ${target}\nGit SHA: ${git.exitCode ? "unavailable" : git.stdout.toString().trim()}\nArtifact SHA256: ${hash.digest("hex")}`)

async function run(generation: keyof typeof hosts) {
  const host = hosts[generation]
  const runtime = path.join(host.root, host.runtime)
  const sandbox = await createSandbox(`rich-footer-installed-${generation}-`)
  try {
    const staging = path.join(sandbox.directory, "stage")
    await mkdir(path.join(staging, "tests"), { recursive: true })
    const file = `${generation}-installed.test.tsx`
    await cp(path.join(root, "tests", file), path.join(staging, "tests", file))
    const support = Bun.resolveSync("@opentui/solid/runtime-plugin-support/configure", runtime)
    const keymap = Bun.resolveSync("@opentui/keymap/runtime-modules", runtime)
    const preload = path.join(staging, "preload.ts")
    await writeFile(preload, [
      `import { ensureRuntimePluginSupport } from ${JSON.stringify(pathToFileURL(support).href)}`,
      `import { runtimeModules } from ${JSON.stringify(pathToFileURL(keymap).href)}`,
      "ensureRuntimePluginSupport({ additional: runtimeModules })",
    ].join("\n"))
    const version = Bun.spawnSync([host.bun, "--version"], { env: sandbox.env, stdout: "pipe", stderr: "pipe" })
    if (version.exitCode) throw new Error(`Cannot inspect ${generation} Bun runtime: ${version.stderr.toString()}`)
    console.log(`${generation} runtime: ${host.bun} (${version.stdout.toString().trim()}), host: ${runtime}`)
    const child = Bun.spawn([host.bun, "test", "--preload", preload, "--timeout", "60000", path.join(staging, "tests", file)], {
      cwd: runtime, stdout: "inherit", stderr: "inherit",
      env: { ...sandbox.env, RICH_FOOTER_INSTALLED: target, RICH_FOOTER_HOST: host.root, RICH_FOOTER_PRELOAD: preload },
    })
    const exitCode = await child.exited
    if (exitCode) throw new Error(`${generation} installed smoke exited ${exitCode}`)
  } finally { await sandbox.dispose() }
}

const generations = (["v1", "v2"] as const).filter((generation) => !selected || generation === selected)
if (process.argv.includes("--concurrent")) {
  const results = await Promise.allSettled(generations.map(run))
  const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
  if (failed.length) throw new AggregateError(failed.map((result) => result.reason), "Installed smokes failed")
} else {
  for (const generation of generations) await run(generation)
}
