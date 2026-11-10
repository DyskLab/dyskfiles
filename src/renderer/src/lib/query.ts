/**
 * Search syntax for the toolbar search box.
 *
 *   logo red                every word must match (in the enabled search fields)
 *   "dark logo"             a quoted phrase
 *   -draft                  exclude items that match
 *   tag:logo                has a tag equal to "logo" (tag:"brand kit" for spaces)
 *   folder:clients          is in a folder whose name contains "clients"
 *   ext:png  type:png       extension; several with commas: ext:png,jpg
 *   kind:video              image, video, audio, text, pdf, font
 *   rating:>3  rating:5     also >=, <, <=
 *   w:>1920  h:<=1080       width and height in pixels
 *   size:>2mb  size:<500kb  b, kb, mb, gb
 *   name: url: note: comment:  text inside that field
 *   is:linked  is:untagged  is:uncategorized  is:rated  has:url  has:note  has:comment
 *
 * Any term can be negated with a leading "-". A term with an unknown key is
 * searched as plain text, so "10:30" still finds "10:30".
 */

export type SearchField =
  | 'name' | 'folderName' | 'folderDesc' | 'extension' | 'tags' | 'url' | 'comment' | 'note'

type Cmp = '>' | '>=' | '<' | '<=' | '='

export type Term =
  | { type: 'text'; value: string; negate: boolean }
  | { type: 'field'; key: string; value: string; negate: boolean }

const FIELD_KEYS = new Set([
  'tag', 'tags', 'folder', 'ext', 'type', 'kind', 'rating', 'w', 'width', 'h', 'height',
  'size', 'name', 'url', 'note', 'comment', 'is', 'has'
])

/** Split a query into terms, honoring quotes and a leading "-". */
export function parseQuery(input: string): Term[] {
  const terms: Term[] = []
  // -?key:"quoted" | -?key:bare | -?"quoted" | -?bare
  const re = /(-?)(?:([a-z]+):)?(?:"([^"]*)"?|(\S+))/gi
  for (const m of input.matchAll(re)) {
    const negate = m[1] === '-'
    const key = m[2]?.toLowerCase()
    const value = (m[3] ?? m[4] ?? '').toLowerCase()
    if (key && FIELD_KEYS.has(key)) {
      if (value) terms.push({ type: 'field', key, value, negate })
      continue
    }
    // Unknown key: keep the whole token as text ("10:30", "http://…").
    const text = key ? `${key}:${value}` : value
    if (text && text !== '-') terms.push({ type: 'text', value: text, negate })
  }
  return terms
}

function compare(actual: number, spec: string, parse: (s: string) => number | null): boolean {
  const m = /^(>=|<=|>|<|=)?(.+)$/.exec(spec)
  if (!m) return false
  const op = (m[1] ?? '=') as Cmp
  const want = parse(m[2])
  if (want === null) return false
  switch (op) {
    case '>': return actual > want
    case '>=': return actual >= want
    case '<': return actual < want
    case '<=': return actual <= want
    default: return actual === want
  }
}

const num = (s: string): number | null => {
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const UNITS: Record<string, number> = { b: 1, k: 1024, kb: 1024, m: 1024 ** 2, mb: 1024 ** 2, g: 1024 ** 3, gb: 1024 ** 3 }
export function parseSize(s: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*([kmg]?b?)?$/.exec(s)
  if (!m) return null
  return Math.round(Number(m[1]) * (UNITS[m[2] || 'b'] ?? 1))
}

export interface QueryContext {
  fields: Record<SearchField, boolean>
  /** Names of the folders this item is in. */
  folderNames: string[]
}

function textMatches(it: RakItem, q: string, ctx: QueryContext): boolean {
  const has = (s: string | null | undefined): boolean => !!s && s.toLowerCase().includes(q)
  const f = ctx.fields
  return (
    (f.name && has(it.name)) ||
    (f.extension && has(it.ext)) ||
    (f.tags && (it.tags ?? []).some(has)) ||
    (f.url && has(it.url)) ||
    (f.comment && has(it.comment)) ||
    (f.note && has(it.note)) ||
    (f.folderName && ctx.folderNames.some(has))
  )
}

function fieldMatches(it: RakItem, key: string, value: string, ctx: QueryContext): boolean {
  const has = (s: string | null | undefined): boolean => !!s && s.toLowerCase().includes(value)
  const list = value.split(',').filter(Boolean)
  switch (key) {
    case 'tag':
    case 'tags':
      return (it.tags ?? []).some((t) => list.includes(t.toLowerCase()))
    case 'folder':
      return ctx.folderNames.some(has)
    case 'ext':
    case 'type':
      return list.map((e) => e.replace(/^\./, '')).includes(it.ext.toLowerCase())
    case 'kind':
      return list.includes(it.kind)
    case 'rating':
      return compare(it.rating ?? 0, value, num)
    case 'w':
    case 'width':
      return compare(it.width, value, num)
    case 'h':
    case 'height':
      return compare(it.height, value, num)
    case 'size':
      return compare(it.size, value, parseSize)
    case 'name':
      return has(it.name)
    case 'url':
      return has(it.url)
    case 'note':
      return has(it.note)
    case 'comment':
      return has(it.comment)
    case 'is':
      switch (value) {
        case 'linked': return it.linked
        case 'untagged': return !(it.tags ?? []).length
        case 'uncategorized': return !(it.folderIds ?? []).length
        case 'rated': return (it.rating ?? 0) > 0
        default: return false
      }
    case 'has':
      switch (value) {
        case 'url': return !!it.url
        case 'note': return !!it.note
        case 'comment': return !!it.comment
        case 'tags':
        case 'tag': return (it.tags ?? []).length > 0
        case 'folder': return (it.folderIds ?? []).length > 0
        default: return false
      }
    default:
      return false
  }
}

/** Does the item match every term? An empty term list matches everything. */
export function matchTerms(it: RakItem, terms: Term[], ctx: QueryContext): boolean {
  for (const t of terms) {
    const hit = t.type === 'text' ? textMatches(it, t.value, ctx) : fieldMatches(it, t.key, t.value, ctx)
    if (hit === t.negate) return false
  }
  return true
}
