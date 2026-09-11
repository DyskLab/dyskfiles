<script lang="ts">
  import {
    items,
    trash,
    view,
    setView,
    folders,
    smartFolders,
    allTags,
    filters,
    addFolder,
    removeFolder,
    addTag,
    deleteTagGlobal,
    addSmartFolder,
    applySmartFolder,
    removeSmartFolder,
    type View
  } from '../lib/store'
  import LibrarySwitcher from './LibrarySwitcher.svelte'
  import SidebarTools from './SidebarTools.svelte'
  import Icon from './Icon.svelte'

  const uncategorized = $derived($items.filter((it) => !(it.folderIds ?? []).length).length)
  const untagged = $derived($items.filter((it) => !it.tags || it.tags.length === 0).length)
  const recentCount = $derived($items.filter((it) => it.lastUsedAt).length)

  let creatingFolder = $state(false)
  let newFolderName = $state('')
  let creatingTag = $state(false)
  let newTagName = $state('')
  let creatingSmart = $state(false)
  let newSmartName = $state('')

  async function confirmCreateTag() {
    const n = newTagName.trim()
    if (n) await addTag(n)
    newTagName = ''
    creatingTag = false
  }
  async function confirmCreateSmart() {
    const n = newSmartName.trim()
    if (n) await addSmartFolder(n)
    newSmartName = ''
    creatingSmart = false
  }

  function folderCount(id: string): number {
    return $items.filter((it) => (it.folderIds ?? []).includes(id)).length
  }
  function tagCount(t: string): number {
    return $items.filter((it) => (it.tags ?? []).includes(t)).length
  }
  function openFolder(id: string) {
    setView('all')
    filters.update((f) => ({ ...f, folderId: f.folderId === id ? null : id, tags: [] }))
  }
  function toggleTag(t: string) {
    setView('all')
    filters.update((f) => ({
      ...f,
      folderId: null,
      tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t]
    }))
  }
  async function confirmCreateFolder() {
    const name = newFolderName.trim()
    if (name) await addFolder(name)
    newFolderName = ''
    creatingFolder = false
  }

  const nav: {
    key: View
    icon: string
    label: string
    count?: () => number
  }[] = $derived([
    { key: 'all', icon: 'grid', label: 'All', count: () => $items.length },
    { key: 'uncategorized', icon: 'inbox', label: 'Uncategorized', count: () => uncategorized },
    { key: 'untagged', icon: 'tag', label: 'Untagged', count: () => untagged },
    { key: 'recent', icon: 'clock', label: 'Recently Used', count: () => recentCount },
    { key: 'random', icon: 'shuffle', label: 'Random' },
    { key: 'alltags', icon: 'tag', label: 'All Tags', count: () => $allTags.length },
    { key: 'trash', icon: 'trash', label: 'Trash', count: () => $trash.length }
  ])
</script>

<aside class="sidebar">
  <div class="titlebar drag">
    <SidebarTools />
  </div>

  <div class="head">
    <LibrarySwitcher />
  </div>

  <div class="scroll">
  <nav class="nav">
    {#each nav as item (item.key)}
      <button
        class="nav-item"
        class:active={$view === item.key}
        onclick={() => setView(item.key)}
      >
        <span class="ico"><Icon name={item.icon} size={16} /></span>
        <span class="label">{item.label}</span>
        {#if item.count}<span class="count">{item.count()}</span>{/if}
      </button>
    {/each}
  </nav>

  <div class="section">
    <span>Smart Folders</span>
    <button class="addbtn" title="Save current filters as smart folder" onclick={() => (creatingSmart = true)}>
      <Icon name="plus" size={13} />
    </button>
  </div>
  {#if creatingSmart}
    <div class="newfolder">
      <input
        bind:value={newSmartName}
        placeholder="Smart folder name"
        spellcheck="false"
        onkeydown={(e) => {
          if (e.key === 'Enter') confirmCreateSmart()
          if (e.key === 'Escape') { creatingSmart = false; newSmartName = '' }
        }}
      />
    </div>
  {/if}
  {#if $smartFolders.length === 0 && !creatingSmart}
    <div class="empty-note">No smart folders</div>
  {:else}
    {#each $smartFolders as sf (sf.id)}
      <button class="folder-item" onclick={() => applySmartFolder(sf)}>
        <span class="ico"><Icon name="smart-folder" size={15} /></span>
        <span class="label">{sf.name}</span>
        <span class="del" role="button" tabindex="0" title="Delete smart folder" onclick={(e) => { e.stopPropagation(); removeSmartFolder(sf.id) }} onkeydown={() => {}}>
          <Icon name="x" size={12} />
        </span>
      </button>
    {/each}
  {/if}

  <div class="section">
    <span>Tags</span>
    <button class="addbtn" title="New tag" onclick={() => (creatingTag = true)}>
      <Icon name="plus" size={13} />
    </button>
  </div>
  {#if creatingTag}
    <div class="newfolder">
      <input
        bind:value={newTagName}
        placeholder="Tag name"
        spellcheck="false"
        onkeydown={(e) => {
          if (e.key === 'Enter') confirmCreateTag()
          if (e.key === 'Escape') { creatingTag = false; newTagName = '' }
        }}
      />
    </div>
  {/if}
  {#if $allTags.length === 0 && !creatingTag}
    <div class="empty-note">No tags yet</div>
  {:else}
    <div class="chips">
      {#each $allTags as t (t)}
        <span class="tagchip" class:on={$filters.tags.includes(t)}>
          <button class="tagbtn" onclick={() => toggleTag(t)}>{t}<span class="c">{tagCount(t)}</span></button>
          <button class="tagdel" title="Delete tag" onclick={() => deleteTagGlobal(t)}><Icon name="x" size={10} /></button>
        </span>
      {/each}
    </div>
  {/if}

  <div class="section">
    <span>Folders</span>
    <button class="addbtn" title="New folder" onclick={() => (creatingFolder = true)}>
      <Icon name="plus" size={13} />
    </button>
  </div>
  {#if creatingFolder}
    <div class="newfolder">
      <input
        bind:value={newFolderName}
        placeholder="Folder name"
        spellcheck="false"
        onkeydown={(e) => {
          if (e.key === 'Enter') confirmCreateFolder()
          if (e.key === 'Escape') {
            creatingFolder = false
            newFolderName = ''
          }
        }}
      />
    </div>
  {/if}
  {#if $folders.length === 0 && !creatingFolder}
    <div class="empty-note">No folders yet</div>
  {:else}
    {#each $folders as f (f.id)}
      <button class="folder-item" class:active={$filters.folderId === f.id} onclick={() => openFolder(f.id)}>
        <span class="ico"><Icon name="folder" size={15} /></span>
        <span class="label">{f.name}</span>
        <span class="count">{folderCount(f.id)}</span>
        <span
          class="del"
          role="button"
          tabindex="0"
          title="Delete folder"
          onclick={(e) => {
            e.stopPropagation()
            removeFolder(f.id)
          }}
          onkeydown={() => {}}
        >
          <Icon name="x" size={12} />
        </span>
      </button>
    {/each}
  {/if}
  </div>
</aside>

<style>
  .sidebar {
    background: var(--sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    /* visible + relative so popovers (Add menu) can overflow above the content */
    overflow: visible;
    position: relative;
    z-index: 20;
  }

  /* Top strip aligned with the macOS traffic lights; holds Add + Search. */
  .titlebar {
    height: var(--titlebar-h);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end; /* + / search / collapse aligned right */
    padding: 0 8px 0 76px; /* left space kept clear for the traffic lights */
  }

  .head {
    padding: 4px 10px 8px;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 12px;
  }

  .nav {
    padding: 4px 8px;
  }
  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 9px;
    border-radius: 8px;
    color: var(--text);
    background: transparent;
    border: none;
    font: inherit;
    text-align: left;
  }
  button.nav-item {
    cursor: pointer;
  }
  button.nav-item:hover {
    background: var(--bg-elev);
  }
  button.nav-item.active,
  button.nav-item.active:hover {
    background: var(--accent-soft);
  }
  .nav-item .ico {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    color: var(--text-dim);
  }
  .nav-item .label {
    flex: 1;
  }
  .nav-item .count {
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .nav-item.active {
    background: var(--accent-soft);
    color: #cfe0ff;
  }
  .nav-item.active .ico {
    color: #9dc0ff;
  }

  .section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 12px 6px 18px;
    color: var(--text-faint);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .addbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-faint);
  }
  .addbtn:hover {
    background: var(--bg-elev);
    color: var(--text);
  }
  .empty-note {
    padding: 2px 18px 4px;
    color: var(--text-faint);
    font-size: 12px;
    font-style: italic;
    opacity: 0.7;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 2px 12px 4px;
  }
  .tagchip {
    display: inline-flex;
    align-items: center;
    padding: 2px 4px 2px 6px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 12px;
  }
  .tagchip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #cfe0ff;
  }
  .tagbtn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 12px;
    padding: 1px 3px;
  }
  .tagbtn:hover {
    color: var(--text);
  }
  .tagchip .c {
    color: var(--text-faint);
    font-size: 10px;
  }
  .tagdel {
    display: none;
    align-items: center;
    background: transparent;
    border: none;
    color: var(--text-faint);
    padding: 1px;
    border-radius: 50%;
  }
  .tagchip:hover .tagdel {
    display: inline-flex;
  }
  .tagdel:hover {
    background: rgba(220, 60, 60, 0.15);
    color: #ff8080;
  }

  .newfolder {
    padding: 2px 12px 4px;
  }
  .newfolder input {
    width: 100%;
    padding: 6px 9px;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 7px;
    color: var(--text);
    outline: none;
    font-size: 13px;
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 12px 7px 16px;
    background: transparent;
    border: none;
    color: var(--text);
    text-align: left;
  }
  .folder-item:hover {
    background: var(--bg-elev);
  }
  .folder-item.active {
    background: var(--accent-soft);
    color: #cfe0ff;
  }
  .folder-item .ico {
    display: flex;
    color: var(--text-dim);
  }
  .folder-item.active .ico {
    color: #9dc0ff;
  }
  .folder-item .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .folder-item .count {
    color: var(--text-faint);
    font-size: 12px;
  }
  .folder-item .del {
    display: none;
    align-items: center;
    color: var(--text-faint);
    border-radius: 4px;
    padding: 2px;
  }
  .folder-item:hover .del {
    display: flex;
  }
  .folder-item .del:hover {
    background: rgba(220, 60, 60, 0.15);
    color: #ff8080;
  }
</style>
