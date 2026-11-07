import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface LibraryRef {
  path: string
  name: string
  icon?: string
}

export interface AppConfig {
  lastLibraryPath: string | null
  libraries: LibraryRef[]
  /** UI preferences that survive relaunch (filters, sort, layout, view options). */
  prefs: Record<string, unknown>
}

const CONFIG_FILE = () => join(app.getPath('userData'), 'rak-config.json')
// Where the config lived before the app was renamed. Read once; the next write lands in CONFIG_FILE.
const LEGACY_CONFIG_FILE = () => join(app.getPath('appData'), 'pitek', 'rak-config.json')

const DEFAULT_CONFIG: AppConfig = {
  lastLibraryPath: null,
  libraries: [],
  prefs: {}
}

export async function readConfig(): Promise<AppConfig> {
  for (const file of [CONFIG_FILE(), LEGACY_CONFIG_FILE()]) {
    try {
      const raw = await fs.readFile(file, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } catch {
      // Missing or unreadable: try the next location.
    }
  }
  return { ...DEFAULT_CONFIG }
}

export async function writeConfig(patch: Partial<AppConfig>): Promise<void> {
  const current = await readConfig()
  const next = { ...current, ...patch }
  await fs.writeFile(CONFIG_FILE(), JSON.stringify(next, null, 2), 'utf-8')
}

/** Read persisted UI preferences. */
export async function readPrefs(): Promise<Record<string, unknown>> {
  const cfg = await readConfig()
  return cfg.prefs ?? {}
}

/** Merge a patch into persisted UI preferences. */
export async function writePrefs(patch: Record<string, unknown>): Promise<void> {
  const cfg = await readConfig()
  await writeConfig({ prefs: { ...(cfg.prefs ?? {}), ...patch } })
}

/** Add/refresh a library in the known list and mark it as the active one. */
export async function rememberLibrary(ref: LibraryRef): Promise<void> {
  const cfg = await readConfig()
  const libraries = cfg.libraries.filter((l) => l.path !== ref.path)
  libraries.unshift(ref) // most-recent first
  await writeConfig({ lastLibraryPath: ref.path, libraries })
}

/** Remove a library from the known list (does NOT touch files on disk). */
export async function forgetLibrary(path: string): Promise<LibraryRef[]> {
  const cfg = await readConfig()
  const libraries = cfg.libraries.filter((l) => l.path !== path)
  const patch: Partial<AppConfig> = { libraries }
  if (cfg.lastLibraryPath === path) patch.lastLibraryPath = libraries[0]?.path ?? null
  await writeConfig(patch)
  return libraries
}
