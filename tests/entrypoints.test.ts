import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import legacy from "../src/index"
import dual from "../src/tui"

test("legacy/server discovery cannot mistake the client hook for a v2 server setup", () => {
  expect(legacy.id).toBe("opencode-rich-footer")
  expect(Object.keys(legacy).sort()).toEqual(["id", "tui"])
  expect(legacy.tui).toBe(dual.tui)
  expect(typeof dual.setup).toBe("function")
})

test("actual Node import stays UI-free and rejects both activation paths clearly", () => {
  const node = Bun.which("node")
  if (!node) throw new Error("Node is required to verify the unsupported-runtime diagnostic")
  const entry = new URL("../src/tui.js", import.meta.url).href
  const result = Bun.spawnSync([node, "--input-type=module", "-e", `
    const mod = await import(${JSON.stringify(entry)});
    for (const activate of [mod.tui, mod.setup]) {
      try { await activate({}); throw new Error('activation unexpectedly succeeded') }
      catch (error) {
        if (!error.message.includes('requires the Bun TUI host')) throw error;
      }
    }
    console.log('guard passed before UI import');
  `], { stdout: "pipe", stderr: "pipe" })
  expect(result.exitCode).toBe(0)
  expect(result.stderr.toString()).toBe("")
  expect(result.stdout.toString()).toContain("guard passed before UI import")
})

test("emitted facade imports generations lazily without SDK or UI dependencies", async () => {
  const entry = fileURLToPath(new URL("../src/tui.js", import.meta.url))
  const scan = new Bun.Transpiler({ loader: "js" }).scan(await Bun.file(entry).text())
  expect(scan.imports.filter((item) => item.kind !== "dynamic-import")).toEqual([])
  expect(scan.imports.map((item) => item.path).sort()).toEqual(["./adapters/v1.js", "./adapters/v2.js"])
})
