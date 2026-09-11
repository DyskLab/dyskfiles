<script lang="ts">
  import {
    displayed,
    allTags,
    selectAdjacent,
    view,
    emptyTrash,
    thumbSize,
    query,
    searchFields,
    SEARCH_FIELDS,
    filterBarOpen,
    activeFilterCount
  } from '../lib/store'
  import Icon from './Icon.svelte'
  import ViewOptions from './ViewOptions.svelte'
  import { tooltip } from '../lib/tooltip'

  let emptying = $state(false)
  let scopeOpen = $state(false)
  let searchEl = $state<HTMLElement>()

  function onWindowClick(e: MouseEvent) {
    if (searchEl && !searchEl.contains(e.target as Node)) scopeOpen = false
  }
  $effect(() => {
    if (scopeOpen) {
      window.addEventListener('click', onWindowClick, true)
      return () => window.removeEventListener('click', onWindowClick, true)
    }
    return
  })

  const LABELS: Record<string, string> = {
    all: 'All',
    uncategorized: 'Uncategorized',
    untagged: 'Untagged',
    recent: 'Recently Used',
    random: 'Random',
    alltags: 'All Tags',
    trash: 'Trash'
  }
  const title = $derived(LABELS[$view] ?? 'All')
  const isTags = $derived($view === 'alltags')
  const count = $derived(isTags ? $allTags.length : $displayed.length)
  const unit = $derived(isTags ? (count === 1 ? 'tag' : 'tags') : count === 1 ? 'item' : 'items')

  async function doEmptyTrash() {
    if (emptying) return
    emptying = true
    try {
      await emptyTrash()
    } finally {
      emptying = false
    }
  }
</script>

<header class="toolbar drag">
  <div class="left">
    <div class="nav no-drag">
      <button
        class="navbtn"
        use:tooltip={'Previous item'}
        aria-label="Previous item"
        disabled={$displayed.length === 0}
        onclick={() => selectAdjacent(-1)}
      >
        <Icon name="chevron-left" size={18} />
      </button>
      <button
        class="navbtn"
        use:tooltip={'Next item'}
        aria-label="Next item"
        disabled={$displayed.length === 0}
        onclick={() => selectAdjacent(1)}
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
    <h2>{title}</h2>
    <span class="count">{count} {unit}</span>
  </div>

  <div class="center no-drag">
    <div class="zoom" title="Thumbnail size">
      <Icon name="minus" size={14} />
      <input type="range" min="120" max="360" step="10" bind:value={$thumbSize} />
      <Icon name="plus" size={14} />
    </div>
  </div>

  <div class="right no-drag">
    <button
      class="ficon"
      class:on={$filterBarOpen || $activeFilterCount > 0}
      use:tooltip={'Toggle filter bar'}
      aria-label="Toggle filter bar"
      onclick={() => filterBarOpen.update((v) => !v)}
    >
      <Icon name="filter" size={16} />
      {#if $activeFilterCount}<span class="fbadge">{$activeFilterCount}</span>{/if}
    </button>

    <ViewOptions />

    <div class="search" bind:this={searchEl}>
      <span class="si"><Icon name="search" size={14} /></span>
      <input class="qinput" bind:value={$query} placeholder="Search…" spellcheck="false" />
      {#if $query}<button class="qclear" onclick={() => query.set('')} title="Clear"><Icon name="x" size={13} /></button>{/if}
      <button class="scopebtn" use:tooltip={'Search scope'} aria-label="Search scope" onclick={() => (scopeOpen = !scopeOpen)}>
        <Icon name="sliders" size={14} />
      </button>
      {#if scopeOpen}
        <div class="scopemenu">
          <div class="smhead">Search Scope:</div>
          {#each SEARCH_FIELDS as f (f.key)}
            <button
              class="smitem"
              onclick={() => searchFields.update((s) => ({ ...s, [f.key]: !s[f.key] }))}
            >
              <span class="smico"><Icon name={f.icon} size={15} /></span>
              <span class="smlabel">{f.label}</span>
              {#if $searchFields[f.key]}<Icon name="check" size={15} />{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if $view === 'trash'}
      <button class="danger" onclick={doEmptyTrash} disabled={emptying || count === 0}>
        <Icon name="trash" size={15} />
        <span>{emptying ? 'Emptying…' : 'Empty Trash'}</span>
      </button>
    {/if}
  </div>
</header>

<style>
  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    padding: 0 16px;
    /* single row aligned with the macOS traffic lights (no top padding) */
    min-height: var(--titlebar-h);
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }

  .left {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .navbtn {
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
  .navbtn:hover:not(:disabled) {
    background: var(--bg-elev);
    color: var(--text);
  }
  .navbtn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .center {
    justify-self: center;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .count {
    color: var(--text-faint);
    font-size: 12px;
  }

  .right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ficon {
    display: flex;
    align-items: center;
    gap: 3px;
    height: 28px;
    min-width: 30px;
    padding: 0 6px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-dim);
  }
  .ficon:hover,
  .ficon.on {
    background: var(--bg-elev);
    color: var(--text);
  }
  .fbadge {
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--accent);
    border-radius: 999px;
    padding: 0 5px;
    line-height: 15px;
  }

  .zoom {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-dim);
  }
  .zoom input[type='range'] {
    width: 120px;
    accent-color: var(--accent);
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px 4px 8px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 9px;
  }
  .si {
    display: flex;
    color: var(--text-faint);
  }
  .qinput {
    width: 150px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 13px;
  }
  .qclear {
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    color: var(--text-faint);
    padding: 1px;
    border-radius: 50%;
  }
  .qclear:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .scopebtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-dim);
  }
  .scopebtn:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .scopemenu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 70;
    width: 220px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
  }
  .smhead {
    padding: 6px 8px;
    color: var(--text-faint);
    font-size: 12px;
  }
  .smitem {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text);
    text-align: left;
  }
  .smitem:hover {
    background: var(--bg-elev-2);
  }
  .smico {
    display: flex;
    color: var(--text-dim);
  }
  .smlabel {
    flex: 1;
    font-size: 13px;
  }
  .smitem :global(svg) {
    color: var(--accent);
  }
  .smico :global(svg) {
    color: var(--text-dim);
  }

  .danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px 8px 11px;
    background: transparent;
    border: 1px solid #6b2b2b;
    border-radius: 8px;
    color: #ff8080;
    font-weight: 600;
  }
  .danger:hover:not(:disabled) {
    background: rgba(220, 60, 60, 0.12);
  }
  .danger:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
