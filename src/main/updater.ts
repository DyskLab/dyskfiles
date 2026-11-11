import { app, BrowserWindow, dialog, net, shell } from 'electron'
import { createHash } from 'crypto'
import { createReadStream, createWriteStream, promises as fs } from 'fs'
import { join } from 'path'
import { readPrefs, writePrefs } from './config'

/**
 * Update checks against GitHub Releases.
 *
 * macOS only installs updates in place for apps signed with an Apple Developer
 * ID, which DyskFiles is not, so this is a notifier: it finds a newer release,
 * downloads the installer for this platform (verifying size and, when GitHub
 * provides it, SHA-256) and opens it: the DMG on macOS, for the user to drag
 * into Applications, or the setup .exe on Windows.
 */

const REPO = 'DyskLab/dyskfiles'
const FEED = `https://api.github.com/repos/${REPO}/releases/latest`
const DAY = 24 * 60 * 60 * 1000

export interface ReleaseAsset {
  name: string
  url: string
  size: number
  /** "sha256:<hex>" when GitHub reports it. */
  digest?: string
}

export interface UpdateInfo {
  version: string
  current: string
  notes: string
  page: string
  asset: ReleaseAsset
}

interface UpdatePrefs {
  auto: boolean
  lastCheck: number
  skip: string | null
}

// ---------- pure helpers (tested) ----------

/** Compare dotted versions ("v1.2.10" > "1.2.9"). A pre-release sorts below its release. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): { nums: number[]; pre: string } => {
    const [main, pre = ''] = v.trim().replace(/^v/i, '').split('-', 2)
    return { nums: main.split('.').map((n) => parseInt(n, 10) || 0), pre }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0)
    if (d) return Math.sign(d)
  }
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

/**
 * The installer for this platform and architecture: a DMG on macOS, a setup .exe on
 * Windows. Falls back to a universal or architecture-less file of the right kind.
 */
export function pickAsset(
  assets: ReleaseAsset[],
  arch: string = process.arch,
  platform: string = process.platform
): ReleaseAsset | null {
  const ext = platform === 'win32' ? '.exe' : '.dmg'
  const dmgs = assets.filter((a) => a.name.toLowerCase().endsWith(ext))
  const wanted = arch === 'arm64' ? 'arm64' : 'x64'
  return (
    dmgs.find((a) => a.name.toLowerCase().includes(wanted)) ??
    dmgs.find((a) => /universal/i.test(a.name)) ??
    // An installer without an architecture in its name is assumed to fit.
    dmgs.find((a) => !/arm64|x64|x86|intel/i.test(a.name)) ??
    null
  )
}

interface GitHubRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  assets?: { name: string; browser_download_url: string; size: number; digest?: string | null }[]
}

/** Turn the GitHub API's latest release into update info, or null if it is not newer. */
export function parseRelease(
  json: GitHubRelease,
  current: string,
  arch: string = process.arch,
  platform: string = process.platform
): UpdateInfo | null {
  if (!json.tag_name || json.draft || json.prerelease) return null
  const version = json.tag_name.replace(/^v/i, '')
  if (compareVersions(version, current) <= 0) return null
  const asset = pickAsset(
    (json.assets ?? []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
      ...(a.digest ? { digest: a.digest } : {})
    })),
    arch,
    platform
  )
  if (!asset) return null
  return {
    version,
    current,
    notes: (json.body ?? '').trim(),
    page: json.html_url ?? `https://github.com/${REPO}/releases/latest`,
    asset
  }
}

// ---------- checking ----------

async function readUpdatePrefs(): Promise<UpdatePrefs> {
  const raw = ((await readPrefs()).updates ?? {}) as Partial<UpdatePrefs>
  return { auto: raw.auto !== false, lastCheck: raw.lastCheck ?? 0, skip: raw.skip ?? null }
}

async function writeUpdatePrefs(patch: Partial<UpdatePrefs>): Promise<void> {
  await writePrefs({ updates: { ...(await readUpdatePrefs()), ...patch } })
}

function currentVersion(): string {
  return process.env.DYSKFILES_VERSION || app.getVersion()
}

/** Updates are only offered by the packaged app (or when a test feed is set). */
function enabled(): boolean {
  return app.isPackaged || !!process.env.DYSKFILES_UPDATE_FEED
}

async function fetchLatest(): Promise<UpdateInfo | null> {
  const res = await net.fetch(process.env.DYSKFILES_UPDATE_FEED || FEED, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DyskFiles-Updater' }
  })
  if (res.status === 404) return null // No release published yet.
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
  return parseRelease((await res.json()) as GitHubRelease, currentVersion())
}

let latest: UpdateInfo | null = null

function announce(info: UpdateInfo): void {
  latest = info
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('update:available', info)
}

/** Background check on launch: at most once a day, silent on errors, skips a skipped version. */
export async function autoCheck(): Promise<void> {
  if (!enabled()) return
  const prefs = await readUpdatePrefs()
  if (!prefs.auto) return
  if (Date.now() - prefs.lastCheck < DAY && !process.env.DYSKFILES_UPDATE_FEED) return
  try {
    const info = await fetchLatest()
    await writeUpdatePrefs({ lastCheck: Date.now() })
    if (info && info.version !== prefs.skip) announce(info)
  } catch (err) {
    console.error('Update check failed:', err)
  }
}

/** "Check for Updates…": always checks, and always says what it found. */
export async function manualCheck(win: BrowserWindow | null): Promise<void> {
  const show = (opts: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> =>
    win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)
  if (!enabled()) {
    await show({ type: 'info', message: 'Updates are checked in the packaged app only.' })
    return
  }
  let info: UpdateInfo | null
  try {
    info = await fetchLatest()
  } catch (err) {
    await show({
      type: 'warning',
      message: 'Could not check for updates',
      detail: `${(err as Error).message}. Check your connection and try again.`
    })
    return
  }
  await writeUpdatePrefs({ lastCheck: Date.now(), skip: null })
  if (info) {
    announce(info)
    return
  }
  const prefs = await readUpdatePrefs()
  const { checkboxChecked } = await show({
    type: 'info',
    message: 'DyskFiles is up to date',
    detail: `You have version ${currentVersion()}, the latest release.`,
    checkboxLabel: 'Check for updates automatically',
    checkboxChecked: prefs.auto
  })
  if (checkboxChecked !== prefs.auto) await writeUpdatePrefs({ auto: checkboxChecked })
}

/** The update announced in this session, for windows that subscribe late. */
export function getLatest(): UpdateInfo | null {
  return latest
}

export async function skipVersion(version: string): Promise<void> {
  await writeUpdatePrefs({ skip: version })
  if (latest?.version === version) latest = null
}

export function setAutoCheck(auto: boolean): Promise<void> {
  return writeUpdatePrefs({ auto })
}

// ---------- downloading ----------

let downloading: Promise<string> | null = null

/**
 * Download the announced installer into Downloads (reusing a complete earlier
 * download), verify it, and open it. Returns the installer's path.
 */
export function downloadUpdate(onProgress: (received: number, total: number) => void): Promise<string> {
  if (!latest) return Promise.reject(new Error('No update to download.'))
  const info = latest
  downloading ??= (async () => {
    const dest = join(process.env.DYSKFILES_UPDATE_DIR || app.getPath('downloads'), info.asset.name)
    if (!(await verified(dest, info.asset))) {
      const part = `${dest}.download`
      const res = await net.fetch(info.asset.url, { headers: { 'User-Agent': 'DyskFiles-Updater' } })
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`)
      const total = info.asset.size || Number(res.headers.get('content-length')) || 0
      const out = createWriteStream(part)
      let received = 0
      let last = 0
      try {
        const reader = res.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.byteLength
          if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
          const now = Date.now()
          if (now - last > 150) {
            last = now
            onProgress(received, total)
          }
        }
        await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
      } catch (err) {
        out.destroy()
        await fs.rm(part, { force: true })
        throw err
      }
      onProgress(received, total)
      if (!(await verified(part, info.asset))) {
        await fs.rm(part, { force: true })
        throw new Error('The download is damaged (size or checksum does not match). Try again.')
      }
      await fs.rename(part, dest)
    }
    const err = await shell.openPath(dest)
    if (err) throw new Error(err)
    return dest
  })().finally(() => {
    downloading = null
  })
  return downloading
}

/** Does the file exist with the expected size and (when known) SHA-256? */
async function verified(path: string, asset: ReleaseAsset): Promise<boolean> {
  try {
    const st = await fs.stat(path)
    if (asset.size && st.size !== asset.size) return false
  } catch {
    return false
  }
  const m = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest ?? '')
  if (!m) return true
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex') === m[1].toLowerCase()
}
