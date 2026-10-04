import { expect, test } from "bun:test"
import { cp, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

test("clean Unicode installation diagnoses a missing compiler dependency and recovers with the frozen lock", async () => {
  const base = await realpath(tmpdir())
  const directory = await realpath(await mkdtemp(path.join(base, "footer instalação 日本 ")))
  const root = process.env.RICH_FOOTER_ROOT!
  try {
    await mkdir(path.join(directory, "scripts"))
    for (const file of ["package.json", "bun.lock", "tui.js", "src", "scripts/build.ts"]) {
      await cp(path.join(root, file), path.join(directory, file), { recursive: true })
    }
    const env = { ...process.env, BUN_INSTALL_CACHE_DIR: path.join(directory, "cache") }
    // Without node_modules Bun can auto-install bare imports from the registry,
    // bypassing the missing-dependency check and the subsequent frozen install.
    const build = () => Bun.spawnSync([process.execPath, "--no-install", path.join(directory, "scripts/build.ts")], { cwd: directory, env, stdout: "pipe", stderr: "pipe" })
    const missing = build()
    expect(missing.exitCode).not.toBe(0)
    expect(missing.stderr.toString()).toContain("@babel/core")
    const lock = await readFile(path.join(directory, "bun.lock"))
    const install = Bun.spawnSync([process.execPath, "install", "--frozen-lockfile", "--ignore-scripts"], { cwd: directory, env, stdout: "pipe", stderr: "pipe" })
    if (install.exitCode) throw new Error(install.stderr.toString())
    expect(await readFile(path.join(directory, "bun.lock"))).toEqual(lock)
    const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"))
    for (const dependency of ["@babel/core", "@babel/preset-typescript"]) {
      const installed = JSON.parse(await readFile(path.join(directory, "node_modules", dependency, "package.json"), "utf8"))
      expect(installed.version).toBe(manifest.devDependencies[dependency])
    }
    const recovered = build()
    if (recovered.exitCode) throw new Error(recovered.stderr.toString())
    expect(recovered.stdout.toString()).toContain("ESM build")
    expect(await readFile(path.join(directory, "dist/tui.js"), "utf8")).toContain("requireBun")
    expect(await readFile(path.join(directory, "dist/footer.js"), "utf8")).toContain("opentui:runtime-module")
  } finally {
    if (path.dirname(await realpath(directory)).toLowerCase() !== base.toLowerCase()) throw new Error("Build fixture escaped sandbox")
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)
