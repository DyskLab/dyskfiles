/** Icon name for an item kind, for places that show a file without a picture. */
export function kindIcon(kind: string): string {
  switch (kind) {
    case 'video':
      return 'film'
    case 'audio':
      return 'music'
    case 'font':
      return 'type'
    case 'image':
      return 'image'
    default:
      return 'note' // text, pdf
  }
}
