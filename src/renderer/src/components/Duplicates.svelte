<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { duplicatesOpen, duplicateGroups, cacheBust, trashItem, findDuplicates } from '../lib/store'
  import Icon from './Icon.svelte'

  let busy = $state(false)

  const total = $derived($duplicateGroups.reduce((n, g) => n + g.length, 0))
  const extra = $derived($duplicateGroups.reduce((n, g) => n + (g.length - 1), 0))

  function close() {
    duplicatesOpen.set(false)
  }
  function icon(kind: string): string {
    return kind === 'video' ? 'film' : kind === 'audio' ? 'music' : kind === 'text' ? 'note' : 'image'
  }
  async function trashRest(group: RakItem[]) {
    if (busy) return
    busy = true
    try {
      for (const it of group.slice(1)) await trashItem(it.id)
      await findDuplicates() // refresh groups
    } finally {
      busy = false
    }
  }
  async function trashAllExtras() {
    if (busy) return
    busy = true
    try {
      for (const g of $duplicateGroups) for (const it of g.slice(1)) await trashItem(it.id)
      await findDuplicates()
    } finally {
      busy = false
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onDestroy(() => window.removeEventListener('keydown', onKey))
</script>

<div class="backdrop" onclick={close} role="presentation">
  <div
    class="panel"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-label="Duplicates"
    tabindex="-1"
  >
    <div class="head">
      <div class="title">
        <Icon name="shapes" size={16} />
        <span>Duplicated Items</span>
      </div>
      <button class="close" onclick={close}><Icon name="x" size={16} /></button>
    </div>

    {#if $duplicateGroups.length === 0}
      <div class="empty">
        <Icon name="check" size={40} strokeWidth={1.5} />
        <p>No duplicates found</p>
      </div>
    {:else}
      <div class="summary">
        <span>{$duplicateGroups.length} groups · {total} items · {extra} duplicates</span>
        <button class="dangerlink" onclick={trashAllExtras} disabled={busy}>Trash all extras</button>
      </div>
      <div class="groups">
        {#each $duplicateGroups as group, gi (gi)}
          <div class="group">
            <div class="thumbs">
              {#each group as it, i (it.id)}
                <div class="thumb" class:keep={i === 0} title={`${it.name}.${it.ext}`}>
                  {#if it.kind === 'image'}
                    <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
                  {:else}
                    <span class="ic"><Icon name={icon(it.kind)} size={22} /></span>
                  {/if}
                  {#if i === 0}<span class="badge">Keep</span>{/if}
                </div>
              {/each}
            </div>
            <button class="trashbtn" onclick={() => trashRest(group)} disabled={busy}>
              <Icon name="trash" size={14} /> Trash {group.length - 1} extra{group.length - 1 > 1 ? 's' : ''}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 210;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8vh 5vw;
  }
  .panel {
    width: 640px;
    max-width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    color: var(--text);
  }
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-dim);
  }
  .close:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .empty {
    padding: 60px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--text-dim);
  }
  .summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    color: var(--text-dim);
    font-size: 12px;
  }
  .dangerlink {
    background: transparent;
    border: none;
    color: #ff8080;
    font-weight: 600;
    font-size: 12px;
  }
  .dangerlink:hover {
    text-decoration: underline;
  }
  .groups {
    overflow-y: auto;
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .thumbs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .thumb {
    position: relative;
    width: 72px;
    height: 54px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg-elev);
    border: 1px solid var(--border);
  }
  .thumb.keep {
    border-color: var(--accent);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .thumb .ic {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
  }
  .badge {
    position: absolute;
    left: 3px;
    bottom: 3px;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: var(--accent);
    border-radius: 3px;
    padding: 0 4px;
  }
  .trashbtn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px;
    background: transparent;
    border: 1px solid #6b2b2b;
    border-radius: 8px;
    color: #ff8080;
    font-weight: 600;
    font-size: 12px;
  }
  .trashbtn:hover:not(:disabled) {
    background: rgba(220, 60, 60, 0.12);
  }
  .trashbtn:disabled {
    opacity: 0.5;
  }
</style>
