// A small hover-tooltip action. Usage: <button use:tooltip={'Label'}>…</button>
// Renders a styled bubble in <body> so it never gets clipped by overflow/stacking.

type Placement = 'top' | 'bottom'

export function tooltip(node: HTMLElement, options: string | { text: string; placement?: Placement }) {
  let text = typeof options === 'string' ? options : options.text
  let placement: Placement = typeof options === 'string' ? 'bottom' : options.placement ?? 'bottom'
  let tip: HTMLDivElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function place(): void {
    if (!tip) return
    const r = node.getBoundingClientRect()
    const tr = tip.getBoundingClientRect()
    let top = placement === 'top' ? r.top - tr.height - 8 : r.bottom + 8
    // Flip if it would overflow vertically.
    if (placement === 'bottom' && top + tr.height > window.innerHeight - 6) top = r.top - tr.height - 8
    if (placement === 'top' && top < 6) top = r.bottom + 8
    let left = r.left + r.width / 2 - tr.width / 2
    left = Math.max(6, Math.min(left, window.innerWidth - tr.width - 6))
    tip.style.top = `${Math.round(top)}px`
    tip.style.left = `${Math.round(left)}px`
    tip.style.opacity = '1'
  }

  function show(): void {
    if (!text || tip) return
    tip = document.createElement('div')
    tip.className = 'app-tooltip'
    tip.textContent = text
    document.body.appendChild(tip)
    place()
  }
  function hide(): void {
    clearTimeout(timer)
    if (tip) {
      tip.remove()
      tip = null
    }
  }
  function enter(): void {
    clearTimeout(timer)
    timer = setTimeout(show, 300)
  }

  node.addEventListener('mouseenter', enter)
  node.addEventListener('mouseleave', hide)
  node.addEventListener('mousedown', hide)
  node.addEventListener('click', hide)

  return {
    update(next: string | { text: string; placement?: Placement }) {
      text = typeof next === 'string' ? next : next.text
      placement = typeof next === 'string' ? 'bottom' : next.placement ?? 'bottom'
      if (tip) tip.textContent = text
    },
    destroy() {
      hide()
      node.removeEventListener('mouseenter', enter)
      node.removeEventListener('mouseleave', hide)
      node.removeEventListener('mousedown', hide)
      node.removeEventListener('click', hide)
    }
  }
}
