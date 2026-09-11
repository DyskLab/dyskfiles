<script lang="ts">
  import { items, allTags, filters, setView, deleteTagGlobal } from '../lib/store'
  import Icon from './Icon.svelte'

  function tagCount(t: string): number {
    return $items.filter((it) => (it.tags ?? []).includes(t)).length
  }
  function openTag(t: string) {
    setView('all')
    filters.update((f) => ({ ...f, folderId: null, tags: [t] }))
  }
</script>

<div class="tagspage">
  {#if $allTags.length === 0}
    <div class="empty">
      <div class="empty-ico"><Icon name="tag" size={44} strokeWidth={1.5} /></div>
      <p class="empty-title">No tags yet</p>
      <p class="empty-sub">Tag items from the inspector, or add tags in the sidebar.</p>
    </div>
  {:else}
    <div class="chips">
      {#each $allTags as t (t)}
        <span class="chip">
          <button class="chipmain" onclick={() => openTag(t)} title="Filter by {t}">
            <Icon name="tag" size={14} />
            <span class="name">{t}</span>
            <span class="count">{tagCount(t)}</span>
          </button>
          <button class="del" title="Delete tag" onclick={() => deleteTagGlobal(t)}>
            <Icon name="x" size={12} />
          </button>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tagspage {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 22px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-content: flex-start;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .chip:hover {
    border-color: #4a4a54;
  }
  .chipmain {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 6px 9px 14px;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 14px;
  }
  .chipmain :global(svg) {
    color: var(--text-dim);
  }
  .chipmain:hover {
    background: var(--bg-elev-2);
  }
  .name {
    font-weight: 500;
  }
  .count {
    color: var(--text-faint);
    font-size: 12px;
  }
  .del {
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    width: 26px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--text-faint);
  }
  .del:hover {
    background: rgba(220, 60, 60, 0.15);
    color: #ff8080;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-faint);
    gap: 6px;
  }
  .empty-ico {
    opacity: 0.5;
  }
  .empty-title {
    margin: 6px 0 0;
    color: var(--text);
    font-weight: 600;
  }
  .empty-sub {
    margin: 0;
    font-size: 13px;
  }
</style>
