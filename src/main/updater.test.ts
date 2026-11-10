import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: {}, BrowserWindow: {}, dialog: {}, net: {}, shell: {} }))
const { compareVersions, parseRelease, pickAsset } = await import('./updater')

describe('compareVersions', () => {
  it('orders dotted versions numerically', () => {
    expect(compareVersions('0.2.0', '0.1.0')).toBe(1)
    expect(compareVersions('v1.2.10', '1.2.9')).toBe(1)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1)
  })

  it('puts a pre-release below its release', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.1')).toBe(1)
  })
})

const asset = (name: string) => ({ name, url: `https://x/${name}`, size: 10 })

describe('pickAsset', () => {
  const both = [asset('DyskFiles-1.0.0-arm64.dmg'), asset('DyskFiles-1.0.0-x64.dmg'), asset('DyskFiles-1.0.0-arm64.dmg.blockmap')]
  it('picks the DMG for the architecture', () => {
    expect(pickAsset(both, 'arm64')?.name).toBe('DyskFiles-1.0.0-arm64.dmg')
    expect(pickAsset(both, 'x64')?.name).toBe('DyskFiles-1.0.0-x64.dmg')
  })

  it('falls back to universal or unlabeled DMGs, never the wrong architecture', () => {
    expect(pickAsset([asset('DyskFiles-1.0.0-universal.dmg')], 'x64')?.name).toBe('DyskFiles-1.0.0-universal.dmg')
    expect(pickAsset([asset('DyskFiles-1.0.0.dmg')], 'arm64')?.name).toBe('DyskFiles-1.0.0.dmg')
    expect(pickAsset([asset('DyskFiles-1.0.0-arm64.dmg')], 'x64')).toBeNull()
    expect(pickAsset([asset('notes.zip')], 'arm64')).toBeNull()
  })
})

describe('parseRelease', () => {
  const release = {
    tag_name: 'v0.2.0',
    body: '  New things  ',
    html_url: 'https://github.com/DyskLab/dyskfiles/releases/tag/v0.2.0',
    assets: [{ name: 'DyskFiles-0.2.0-arm64.dmg', browser_download_url: 'https://x/a.dmg', size: 123, digest: 'sha256:ab' }]
  }

  it('returns info for a newer release with a matching DMG', () => {
    expect(parseRelease(release, '0.1.0', 'arm64')).toEqual({
      version: '0.2.0',
      current: '0.1.0',
      notes: 'New things',
      page: release.html_url,
      asset: { name: 'DyskFiles-0.2.0-arm64.dmg', url: 'https://x/a.dmg', size: 123, digest: 'sha256:ab' }
    })
  })

  it('ignores same or older versions, drafts, pre-releases and releases without a DMG', () => {
    expect(parseRelease(release, '0.2.0', 'arm64')).toBeNull()
    expect(parseRelease(release, '0.3.0', 'arm64')).toBeNull()
    expect(parseRelease({ ...release, prerelease: true }, '0.1.0', 'arm64')).toBeNull()
    expect(parseRelease({ ...release, draft: true }, '0.1.0', 'arm64')).toBeNull()
    expect(parseRelease({ ...release, assets: [] }, '0.1.0', 'arm64')).toBeNull()
    expect(parseRelease(release, '0.1.0', 'x64')).toBeNull()
  })
})
