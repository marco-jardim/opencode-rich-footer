import { transformAsync, type PluginObj } from "@babel/core"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInstrumenter } from "istanbul-lib-instrument"

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
const instrument = process.argv.includes("--coverage")
const out = path.join(root, instrument ? ".cache/instrumented" : "dist")
const initialCoverage: Record<string, ReturnType<ReturnType<typeof createInstrumenter>["lastFileCoverage"]>> = {}
const runtimeModules = new Set(["solid-js", "solid-js/store", "@opentui/core", "@opentui/core/testing", "@opentui/solid", "@opentui/solid/components", "@opentui/solid/jsx-runtime", "@opentui/solid/jsx-dev-runtime"])
function modulePath(specifier: string) {
  if (runtimeModules.has(specifier)) return "opentui:runtime-module:" + encodeURIComponent(specifier)
  if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?js$/.test(specifier)) return specifier + ".js"
  return specifier
}
const imports: PluginObj = {
  visitor: {
    ImportDeclaration(item) { item.node.source.value = modulePath(item.node.source.value) },
    ExportNamedDeclaration(item) { if (item.node.source) item.node.source.value = modulePath(item.node.source.value) },
    ExportAllDeclaration(item) { item.node.source.value = modulePath(item.node.source.value) },
    CallExpression(item) {
      const first = item.node.arguments[0]
      if (item.node.callee.type === "Import" && first?.type === "StringLiteral") first.value = modulePath(first.value)
    },
  },
}

async function build(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await build(file); continue }
    if (!/\.tsx?$/.test(file) || file.endsWith(".d.ts")) continue
    const relative = path.relative(path.join(root, "src"), file).replace(/\.tsx?$/, ".js")
    const result = await transformAsync(await readFile(file, "utf8"), {
      filename: file,
      sourceMaps: true,
      presets: [["@babel/preset-typescript", { allExtensions: true, isTSX: true }], ["babel-preset-solid", { generate: "universal", moduleName: "@opentui/solid" }]],
      babelrc: false,
      configFile: false,
    })
    if (!result?.code) throw new Error(`Empty compilation: ${file}`)
    // Transform after JSX so compiler-generated imports use the same host instances.
    const linked = await transformAsync(result.code, { filename: file, sourceMaps: true, inputSourceMap: result.map ?? undefined, plugins: [imports], babelrc: false, configFile: false })
    if (!linked?.code) throw new Error(`Empty linked compilation: ${file}`)
    const code = linked.code
    const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true })
    const compiled = instrument && entry.name !== "contracts.ts"
      ? instrumenter.instrumentSync(code, file, linked.map ? { ...linked.map, version: String(linked.map.version) } : undefined)
      : code
    const map = instrument && entry.name !== "contracts.ts" ? instrumenter.lastSourceMap() : linked.map
    if (instrument && entry.name !== "contracts.ts") initialCoverage[file] = instrumenter.lastFileCoverage()
    const target = path.join(out, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, compiled + "\n" + (map ? "//# sourceMappingURL=data:application/json;base64," + Buffer.from(JSON.stringify(map)).toString("base64") + "\n" : ""))
  }
}

await build(path.join(root, "src"))
if (instrument) await writeFile(path.join(root, ".cache/coverage-initial.json"), JSON.stringify(initialCoverage))
console.log(`ESM ${instrument ? "instrumented" : "build"}: ${out}`)
