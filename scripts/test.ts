import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createCoverageMap } from "istanbul-lib-coverage"
import { createContext } from "istanbul-lib-report"
import { create } from "istanbul-reports"
import { createSourceMapStore } from "istanbul-lib-source-maps"
import { hosts, root } from "./hosts"
import { createSandbox } from "./sandbox"

const coverage = process.argv.includes("--coverage")
const selected = process.argv.find((arg) => arg === "--v1" || arg === "--v2")?.slice(2)
const build = Bun.spawnSync([process.execPath, "scripts/build.ts", ...(coverage ? ["--coverage"] : [])], { cwd: root, stdout: "inherit", stderr: "inherit" })
if (build.exitCode) process.exit(build.exitCode)
const combined = createCoverageMap(coverage ? JSON.parse(await readFile(path.join(root, ".cache/coverage-initial.json"), "utf8")) : {})
for (const generation of ["v1", "v2"] as const) {
  if (selected && generation !== selected) continue
  const host = hosts[generation]
  const staging = path.join(root, `.cache/test-${generation}`)
  await mkdir(staging, { recursive: true })
  await cp(path.join(root, coverage ? ".cache/instrumented" : "dist"), path.join(staging, "src"), { recursive: true })
  await mkdir(path.join(staging, "tests"), { recursive: true })
  const files = (await readdir(path.join(root, "tests"))).filter((file) => /\.test\.tsx?$/.test(file) && !file.includes("-installed.") && !file.startsWith(generation === "v1" ? "v2" : "v1") && (!process.argv.includes("--unit") || !file.includes("-")))
  for (const file of files) await cp(path.join(root, "tests", file), path.join(staging, "tests", file))
  const runtime = path.join(host.root, host.runtime)
  const support = Bun.resolveSync("@opentui/solid/runtime-plugin-support/configure", runtime)
  const keymap = Bun.resolveSync("@opentui/keymap/runtime-modules", runtime)
  const coverageFile = path.join(staging, "coverage.json")
  await writeFile(path.join(staging, "preload.ts"), [
    `import { ensureRuntimePluginSupport } from ${JSON.stringify(pathToFileURL(support).href)}`,
    `import { runtimeModules } from ${JSON.stringify(pathToFileURL(keymap).href)}`,
    "ensureRuntimePluginSupport({ additional: runtimeModules })",
    coverage ? `import { afterAll } from 'bun:test'; afterAll(() => Bun.write(${JSON.stringify(coverageFile)}, JSON.stringify((globalThis as typeof globalThis & { __coverage__?: unknown }).__coverage__ ?? {})))` : "",
  ].join("\n"))
  const sandbox = await createSandbox(`rich-footer-${generation}-`)
  let exitCode = 1
  try {
    const reports = path.join(sandbox.directory, "coverage")
    const operationalPreload = path.join(staging, "coverage-preload.ts")
    if (coverage) {
      await mkdir(reports)
      await writeFile(operationalPreload, [
        'import { writeFileSync } from "node:fs"',
        `process.on("exit", () => writeFileSync(${JSON.stringify(reports)} + "/" + process.pid + ".json", JSON.stringify(globalThis.__coverage__ ?? {})))`,
      ].join("\n"))
    }
    const result = Bun.spawnSync([host.bun, "test", "--preload", path.join(staging, "preload.ts"), "--timeout", "30000", ...files.map((file) => path.join(staging, "tests", file))], {
      cwd: runtime, stdout: "inherit", stderr: "inherit", env: { ...sandbox.env, RICH_FOOTER_GENERATION: generation, RICH_FOOTER_ROOT: root, RICH_FOOTER_HOST: host.root,
        RICH_FOOTER_OPERATIONAL_ROOT: path.join(root, coverage ? ".cache/instrumented-scripts" : "scripts"),
        RICH_FOOTER_COVERAGE_PRELOAD: coverage ? operationalPreload : undefined,
      },
    })
    exitCode = result.exitCode
    if (coverage) for (const file of await readdir(reports)) combined.merge(JSON.parse(await readFile(path.join(reports, file), "utf8")))
  } finally { await sandbox.dispose() }
  if (exitCode) process.exit(exitCode)
  if (coverage) combined.merge(JSON.parse(await readFile(coverageFile, "utf8")))
}
if (coverage) {
  const directory = path.join(root, "coverage")
  const sourceMaps = createSourceMapStore()
  const mapped = await sourceMaps.transformCoverage(combined)
  const context = createContext({ dir: directory, coverageMap: mapped, sourceFinder: sourceMaps.sourceFinder })
  create("text").execute(context)
  create("json").execute(context)
  create("json-summary").execute(context)
  create("html").execute(context)
  const summary = mapped.getCoverageSummary()
  if (Number(summary.lines.pct) < 90 || Number(summary.branches.pct) < 85) throw new Error("Coverage gate: requires 90% lines and 85% branches")
  for (const name of ["src", "scripts"]) {
    const group = createCoverageMap({})
    for (const file of mapped.files()) if (path.relative(root, file).startsWith(name + path.sep)) group.addFileCoverage(mapped.fileCoverageFor(file))
    const result = group.getCoverageSummary()
    if (!group.files().length || Number(result.lines.pct) < 90 || Number(result.branches.pct) < 85) throw new Error(`Coverage ${name}: requires 90% lines and 85% branches`)
    console.log(`Coverage ${name}: ${result.lines.pct}% lines, ${result.branches.pct}% branches`)
  }
}
