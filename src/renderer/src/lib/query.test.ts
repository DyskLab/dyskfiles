import { describe, expect, it } from 'vitest'
import { matchTerms, parseQuery, parseSize, type QueryContext } from './query'

const ALL = {
  name: true, folderName: true, folderDesc: true, extension: true,
  tags: true, url: true, comment: true, note: true
}

function item(over: Partial<RakItem> = {}): RakItem {
  return {
    id: 'x', name: 'Brand Logo', ext: 'png', kind: 'image', size: 3 * 1024 * 1024,
    width: 2000, height: 1000, importedAt: '', dateModified: '', dateCreated: '', rating: 4,
    duration: null, color: null, colors: [], comment: '', note: 'final version', url: '',
    order: 0, original: '', thumbnail: '', tags: ['logo', 'brand kit'], folderIds: ['f1'],
    lastUsedAt: null, deletedAt: null, linked: false, ...over
  }
}

const ctx: QueryContext = { fields: ALL, folderNames: ['Clients / Acme'] }
const hit = (q: string, it = item(), c = ctx): boolean => matchTerms(it, parseQuery(q), c)

describe('parseQuery', () => {
  it('splits words, phrases, negation and fields', () => {
    expect(parseQuery('red -draft "dark logo" tag:"brand kit" rating:>3')).toEqual([
      { type: 'text', value: 'red', negate: false },
      { type: 'text', value: 'draft', negate: true },
      { type: 'text', value: 'dark logo', negate: false },
      { type: 'field', key: 'tag', value: 'brand kit', negate: false },
      { type: 'field', key: 'rating', value: '>3', negate: false }
    ])
  })

  it('keeps unknown keys and times as plain text', () => {
    expect(parseQuery('10:30 http://x.com foo:bar')).toEqual([
      { type: 'text', value: '10:30', negate: false },
      { type: 'text', value: 'http://x.com', negate: false },
      { type: 'text', value: 'foo:bar', negate: false }
    ])
  })

  it('ignores empty input and a lone dash', () => {
    expect(parseQuery('   ')).toEqual([])
    expect(parseQuery('-')).toEqual([])
  })
})

describe('matchTerms', () => {
  it('requires every word', () => {
    expect(hit('brand logo')).toBe(true)
    expect(hit('brand poster')).toBe(false)
    expect(hit('')).toBe(true)
  })

  it('searches only the enabled fields', () => {
    expect(hit('final')).toBe(true)
    expect(hit('final', item(), { ...ctx, fields: { ...ALL, note: false } })).toBe(false)
  })

  it('excludes negated terms', () => {
    expect(hit('logo -final')).toBe(false)
    expect(hit('-tag:draft')).toBe(true)
  })

  it('matches tags exactly, extensions and kinds by list', () => {
    expect(hit('tag:logo')).toBe(true)
    expect(hit('tag:log')).toBe(false)
    expect(hit('tag:"brand kit"')).toBe(true)
    expect(hit('ext:jpg,png')).toBe(true)
    expect(hit('type:.PNG')).toBe(true)
    expect(hit('kind:video')).toBe(false)
  })

  it('compares numbers', () => {
    expect(hit('rating:>3')).toBe(true)
    expect(hit('rating:>=5')).toBe(false)
    expect(hit('rating:4')).toBe(true)
    expect(hit('w:>1920 h:<=1000')).toBe(true)
    expect(hit('size:>2mb size:<4mb')).toBe(true)
    expect(hit('size:<500kb')).toBe(false)
    expect(hit('rating:>abc')).toBe(false)
  })

  it('handles folder, is: and has:', () => {
    expect(hit('folder:acme')).toBe(true)
    expect(hit('is:rated has:note')).toBe(true)
    expect(hit('is:linked')).toBe(false)
    expect(hit('has:url')).toBe(false)
    expect(hit('is:untagged', item({ tags: [] }))).toBe(true)
    expect(hit('is:uncategorized', item({ folderIds: [] }), { ...ctx, folderNames: [] })).toBe(true)
  })
})

describe('parseSize', () => {
  it('reads units', () => {
    expect(parseSize('500')).toBe(500)
    expect(parseSize('1.5kb')).toBe(1536)
    expect(parseSize('2m')).toBe(2 * 1024 ** 2)
    expect(parseSize('big')).toBeNull()
  })
})
