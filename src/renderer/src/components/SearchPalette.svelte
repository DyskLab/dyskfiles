<script lang="ts">
  import { onMount } from 'svelte'
  import {
    items,
    displayed,
    library,
    folders,
    smartFolders,
    allTags,
    filters,
    selectedId,
    searchOpen,
    searchTab,
    searchScope,
    cacheBust,
    setView,
    applySmartFolder
  } from '../lib/store'
  import { get } from 'svelte/store'
  import Icon from './Icon.svelte'

  const TABS = [
    { key: 'folders', label: 'Folders' },
    { key: 'tags', label: 'Tags' },
    { key: 'smart', label: 'Smart Folders' },
    { key: 'document', label: 'Document' }
  ] as const
  type TabKey = (typeof TABS)[number]['key']

  let query = $state('')
  let activeTab = $state<TabKey>(get(searchTab) as TabKey)
  let selectedIndex = $state(0)
  let inputEl = $state<HTMLInputElement>()
  let listEl = $state<HTMLElement>()

  // Scope: whole library (all active items) or just the current view/filter.
  const scopeItems = $derived($searchScope === 'view' ? $displayed : $items)
  const q = $derived(query.trim().toLowerCase())
  const docResults = $derived(scopeItems.filter((it) => it.name.toLowerCase().includes(q)))
  const tagResults = $derived($allTags.filter((t) => t.toLowerCase().includes(q)))
  const folderResults = $derived($folders.filter((f) => f.name.toLowerCase().includes(q)))
  const smartResults = $derived($smartFolders.filter((s) => s.name.toLowerCase().includes(q)))
  const results = $derived(
    activeTab === 'document'
      ? docResults
      : activeTab === 'tags'
        ? tagResults
        : activeTab === 'folders'
          ? folderResults
          : activeTab === 'smart'
            ? smartResults
            : []
  )

  function chooseAt(i: number) {
    if (activeTab === 'document') {
      const it = docResults[i]
      if (it) {
        setView('all')
        selectedId.set(it.id)
        close()
      }
    } else if (activeTab === 'tags') {
      const t = tagResults[i]
      if (t) {
        setView('all')
        filters.update((f) => ({ ...f, folderId: null, tags: [t] }))
        close()
      }
    } else if (activeTab === 'folders') {
      const fo = folderResults[i]
      if (fo) {
        setView('all')
        filters.update((f) => ({ ...f, folderId: fo.id, tags: [] }))
        close()
      }
    } else if (activeTab === 'smart') {
      const sf = smartResults[i]
      if (sf) {
        applySmartFolder(sf)
        close()
      }
    }
  }

  // Keep the selection valid as results change, and scroll it into view.
  $effect(() => {
    if (selectedIndex >= results.length) selectedIndex = Math.max(0, results.length - 1)
  })
  $effect(() => {
    const row = listEl?.querySelector<HTMLElement>(`[data-i="${selectedIndex}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  })

  function close() {
    searchOpen.set(false)
  }

  function fmtDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length) selectedIndex = (selectedIndex + 1) % results.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length) selectedIndex = (selectedIndex - 1 + results.length) % results.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      chooseAt(selectedIndex)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const i = TABS.findIndex((t) => t.key === activeTab)
      const dir = e.shiftKey ? -1 : 1
      activeTab = TABS[(i + dir + TABS.length) % TABS.length].key
      selectedIndex = 0
    }
  }

  onMount(() => {
    inputEl?.focus()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<div class="backdrop" onclick={close} role="presentation">
  <div
    class="palette"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-label="Search"
    tabindex="-1"
  >
    <div class="search">
      <Icon name="search" size={17} />
      <input bind:this={inputEl} bind:value={query} placeholder="Search" spellcheck="false" />
      <button class="close" onclick={close} title="Close"><Icon name="x" size={16} /></button>
    </div>

    <div class="tabs">
      <div class="tabgroup">
        {#each TABS as tab (tab.key)}
          <button
            class="tab"
            class:active={activeTab === tab.key}
            onclick={() => {
              activeTab = tab.key
              selectedIndex = 0
            }}
          >
            {tab.label}
          </button>
        {/each}
      </div>
      <div class="scope" title="Search scope">
        <button class:on={$searchScope === 'library'} onclick={() => searchScope.set('library')}>
          Library
        </button>
        <button class:on={$searchScope === 'view'} onclick={() => searchScope.set('view')}>
          This View
        </button>
      </div>
    </div>

    <div class="list" bind:this={listEl}>
      {#if activeTab === 'smart'}
        {#if smartResults.length === 0}
          <div class="hint">No smart folders</div>
        {:else}
          {#each smartResults as sf, i (sf.id)}
            <button class="result compact" class:sel={i === selectedIndex} data-i={i} onclick={() => chooseAt(i)} onmousemove={() => (selectedIndex = i)}>
              <span class="rico"><Icon name="smart-folder" size={16} /></span>
              <span class="info"><span class="name">{sf.name}</span></span>
            </button>
          {/each}
        {/if}
      {:else if activeTab === 'document'}
        {#if docResults.length === 0}
          <div class="hint">No matches</div>
        {:else}
          {#each docResults as item, i (item.id)}
            <button class="result" class:sel={i === selectedIndex} data-i={i} onclick={() => chooseAt(i)} onmousemove={() => (selectedIndex = i)}>
              <span class="thumb">
                {#if item.thumbnail}
                  <img src={`asset://thumb/${item.id}?v=${$cacheBust}`} alt={item.name} loading="lazy" />
                {:else}
                  <span class="tfile"><Icon name={item.kind === 'video' ? 'film' : item.kind === 'audio' ? 'music' : 'note'} size={18} /></span>
                {/if}
              </span>
              <span class="info">
                <span class="name">{item.name}.{item.ext}</span>
                <span class="meta">{fmtDate(item.importedAt)} · {$library?.name}</span>
              </span>
            </button>
          {/each}
        {/if}
      {:else if activeTab === 'tags'}
        {#if tagResults.length === 0}
          <div class="hint">No tags</div>
        {:else}
          {#each tagResults as t, i (t)}
            <button class="result compact" class:sel={i === selectedIndex} data-i={i} onclick={() => chooseAt(i)} onmousemove={() => (selectedIndex = i)}>
              <span class="rico"><Icon name="tag" size={16} /></span>
              <span class="info"><span class="name">{t}</span></span>
            </button>
          {/each}
        {/if}
      {:else if activeTab === 'folders'}
        {#if folderResults.length === 0}
          <div class="hint">No folders</div>
        {:else}
          {#each folderResults as fo, i (fo.id)}
            <button class="result compact" class:sel={i === selectedIndex} data-i={i} onclick={() => chooseAt(i)} onmousemove={() => (selectedIndex = i)}>
              <span class="rico"><Icon name="folder" size={16} /></span>
              <span class="info"><span class="name">{fo.name}</span></span>
            </button>
          {/each}
        {/if}
      {/if}
    </div>

    <div class="foot">
      <span><kbd>Tab</kbd> Switch</span>
      <span><kbd>↑</kbd><kbd>↓</kbd> Move</span>
      <span><kbd>↵</kbd> Select</span>
      <span class="right"><kbd>Esc</kbd> Close</span>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
  }
  .palette {
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--text-dim);
  }
  .search input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 15px;
  }
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-dim);
  }
  .close:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }

  .tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  .tabgroup {
    display: flex;
    gap: 6px;
  }
  .scope {
    display: flex;
    gap: 2px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2px;
  }
  .scope button {
    padding: 4px 9px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 600;
  }
  .scope button.on {
    background: var(--accent);
    color: #fff;
  }
  .tab {
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 500;
  }
  .tab:hover {
    background: var(--bg-elev-2);
  }
  .tab.active {
    background: var(--bg-elev-2);
    color: var(--text);
  }

  .list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .hint {
    padding: 40px 0;
    text-align: center;
    color: var(--text-faint);
    font-style: italic;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 9px;
    color: var(--text);
  }
  .result.sel {
    background: var(--accent-soft);
  }
  .result.compact {
    gap: 10px;
    padding: 10px 12px;
  }
  .rico {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    color: var(--text-dim);
  }
  .thumb {
    width: 64px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 6px;
    overflow: hidden;
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .tfile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-dim);
  }
  .info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-size: 12px;
    color: var(--text-faint);
  }

  .foot {
    display: flex;
    gap: 16px;
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    color: var(--text-faint);
    font-size: 11px;
  }
  .foot .right {
    margin-left: auto;
  }
  kbd {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
    margin-right: 3px;
    font-family: inherit;
    font-size: 10px;
  }
</style>
