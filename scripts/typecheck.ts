import { mkdir, writeFile, symlink, lstat } from "node:fs/promises"
import path from "node:path"
import { hosts, root } from "./hosts"

await mkdir(path.join(root, ".cache"), { recursive: true })
const views = { v1: path.join(root, ".cache/host-types-v1"), v2: path.join(root, ".cache/host-types-v2") }
for (const generation of ["v1", "v2"] as const) {
  if (!await lstat(views[generation]).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; return undefined })) {
    await symlink(hosts[generation].root, views[generation], "junction")
  }
}
for (const generation of ["v1", "v2"] as const) {
  const modules = path.join(views[generation], hosts[generation].runtime, "node_modules")
  const paths = {
    "solid-js": [path.join(modules, "solid-js/types/index.d.ts")],
    "solid-js/*": [path.join(modules, "solid-js/*")],
    "@opentui/core": [path.join(modules, "@opentui/core/index.d.ts")],
    "@opentui/core/*": [path.join(modules, "@opentui/core/*")],
    "@opentui/solid": [path.join(modules, "@opentui/solid/index.d.ts")],
    "@opentui/solid/*": [path.join(modules, "@opentui/solid/*")],
    "@opencode-ai/plugin/tui": [path.join(views.v1, "packages/plugin/src/tui.ts")],
    "@opencode-ai/sdk/v2": [path.join(views.v1, "packages/sdk/js/src/v2/index.ts")],
    "@opencode/plugin/tui": [path.join(views.v2, "packages/plugin/src/tui/index.ts")],
    "@opencode/client": [path.join(views.v2, "packages/client/src/promise/index.ts")],
  }
  const config = path.join(root, `.cache/tsconfig-${generation}.json`)
  await writeFile(config, JSON.stringify({
    extends: "../tsconfig.json",
    compilerOptions: { noEmit: true, preserveSymlinks: true, paths, baseUrl: root },
    include: ["../src", "../tests", "../scripts"], exclude: process.argv.includes("--unit") ? ["../tests/*-*.test.tsx"] : [],
  }, null, 2))
  const result = Bun.spawnSync([process.execPath, path.join(root, "node_modules/typescript/bin/tsc"), "-p", config], { cwd: root, stdout: "inherit", stderr: "inherit" })
  if (result.exitCode) process.exit(result.exitCode)
  console.log(`Typecheck ${generation}: passed`)
}
