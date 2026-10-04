import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

/** Set the entire host environment before imports; never use personal state in tests. */
export async function createSandbox(prefix: string) {
  const temporary = await realpath(tmpdir())
  const directory = await realpath(await mkdtemp(path.join(temporary, prefix)))
  const env: Record<string, string | undefined> = { ...process.env }
  for (const key of Object.keys(env)) if (key.startsWith("OPENCODE_")) delete env[key]
  const home = path.join(directory, "home")
  const temp = path.join(directory, "tmp")
  Object.assign(env, {
    HOME: home, USERPROFILE: home, OPENCODE_TEST_HOME: home,
    XDG_DATA_HOME: path.join(directory, "data"),
    XDG_CONFIG_HOME: path.join(directory, "config"),
    XDG_CACHE_HOME: path.join(directory, "cache"),
    XDG_STATE_HOME: path.join(directory, "state"),
    OPENCODE_CONFIG_DIR: path.join(directory, "config", "opencode"),
    TMP: temp, TEMP: temp,
  })
  await Promise.all([home, temp, env.OPENCODE_CONFIG_DIR].map((item) => mkdir(item!, { recursive: true })))
  return {
    directory, env,
    async dispose() {
      const resolved = await realpath(directory)
      if (!resolved.startsWith(temporary + path.sep)) throw new Error("Sandbox escaped temporary root")
      await rm(resolved, { recursive: true, force: true })
    },
  }
}
