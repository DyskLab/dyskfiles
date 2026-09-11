<script lang="ts">
  import {
    library,
    libraries,
    switchTo,
    useLibrary,
    libraryMenu,
    emptyCacheReload
  } from '../lib/store'
  import Icon from './Icon.svelte'

  let open = $state(false)
  let creating = $state(false)
  let newName = $state('My Library')
  let busy = $state(false)
  let rebuilding = $state(false)
  let rootEl: HTMLElement

  function toggle() {
    open = !open
    if (!open) creating = false
  }
  function close() {
    open = false
    creating = false
  }

  function onWindowClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) close()
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  $effect(() => {
    if (open) {
      window.addEventListener('click', onWindowClick, true)
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('click', onWindowClick, true)
        window.removeEventListener('keydown', onKey)
      }
    }
    return
  })

  async function pick(path: string) {
    if (busy) return
    busy = true
    try {
      await switchTo(path)
    } finally {
      busy = false
      close()
    }
  }

  async function openMenu(e: MouseEvent, path: string) {
    e.stopPropagation()
    await libraryMenu(path)
  }

  async function create() {
    if (busy) return
    busy = true
    try {
      const lib = await window.rak.createLibrary(newName)
      if (lib) {
        await useLibrary(lib)
        close()
      }
    } finally {
      busy = false
    }
  }

  async function openExisting() {
    if (busy) return
    busy = true
    try {
      const lib = await window.rak.openLibrary()
      if (lib) {
        await useLibrary(lib)
        close()
      }
    } finally {
      busy = false
    }
  }

  function revealCurrent() {
    const lib = $library
    if (lib) window.rak.revealLibrary(lib.path)
    close()
  }

  async function rebuild() {
    if (rebuilding) return
    rebuilding = true
    try {
      await emptyCacheReload()
    } finally {
      rebuilding = false
      close()
    }
  }
</script>

<div class="switcher" bind:this={rootEl}>
  <button class="trigger no-drag" onclick={toggle} title="Switch library" class:active={open}>
    <span class="lib-icon"><Icon name={$library?.icon ?? 'chicken'} size={17} /></span>
    <span class="lib-name">{$library?.name}</span>
    <span class="chev"><Icon name="chevron" size={15} /></span>
  </button>

  {#if open}
    <div class="menu no-drag">
      <div class="menu-label">Libraries</div>
      <ul class="lib-list">
        {#each $libraries as lib (lib.path)}
          <li>
            <button
              class="lib-row"
              class:current={lib.path === $library?.path}
              class:missing={!lib.available}
              onclick={() => lib.available && pick(lib.path)}
              disabled={!lib.available}
              title={lib.path}
            >
              <span class="row-icon"><Icon name={lib.icon} size={16} /></span>
              <span class="col">
                <span class="row-name">{lib.name}</span>
                <span class="row-path">{lib.available ? lib.path : 'Not found — ' + lib.path}</span>
              </span>
              {#if lib.path === $library?.path}<span class="tick"><Icon name="check" size={14} /></span>{/if}
              <span
                class="more"
                role="button"
                tabindex="0"
                title="Library options"
                onclick={(e) => openMenu(e, lib.path)}
                onkeydown={(e) => e.key === 'Enter' && openMenu(e as unknown as MouseEvent, lib.path)}
              ><Icon name="more" size={16} /></span>
            </button>
          </li>
        {/each}
        {#if $libraries.length === 0}
          <li class="empty">No libraries yet</li>
        {/if}
      </ul>

      <div class="divider"></div>

      {#if creating}
        <div class="create">
          <input
            type="text"
            bind:value={newName}
            placeholder="Library name"
            spellcheck="false"
            onkeydown={(e) => e.key === 'Enter' && create()}
          />
          <div class="create-actions">
            <button class="mini primary" onclick={create} disabled={busy}>Create…</button>
            <button class="mini" onclick={() => (creating = false)}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="action" onclick={() => (creating = true)}>
          <Icon name="plus" size={15} /> New Library…
        </button>
        <button class="action" onclick={openExisting}>
          <Icon name="folder" size={15} /> Open Library…
        </button>
        <div class="divider"></div>
        <button class="action" onclick={revealCurrent} disabled={!$library}>
          <Icon name="reveal" size={15} /> Reveal Library Folder
        </button>
        <button class="action" onclick={rebuild} disabled={rebuilding || !$library}>
          <Icon name="refresh" size={15} />
          {rebuilding ? 'Rebuilding…' : 'Empty Cache & Reload'}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .switcher {
    position: relative;
  }

  .trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
  }
  .trigger:hover,
  .trigger.active {
    background: var(--bg-elev);
  }
  .lib-icon {
    display: flex;
    align-items: center;
    color: var(--text);
  }
  .lib-name {
    font-weight: 700;
    font-size: 14px;
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chev {
    display: flex;
    align-items: center;
    color: var(--text-faint);
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 4px;
    right: 4px;
    z-index: 50;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
  }
  .menu-label {
    padding: 6px 8px 4px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .lib-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 260px;
    overflow-y: auto;
  }
  .lib-list .empty {
    padding: 6px 10px 10px;
    color: var(--text-faint);
    font-style: italic;
    font-size: 12px;
  }

  .lib-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    text-align: left;
  }
  .lib-row:hover:not(:disabled) {
    background: var(--bg-elev-2);
  }
  .lib-row.current {
    background: var(--accent-soft);
  }
  .lib-row.missing {
    opacity: 0.55;
    cursor: default;
  }
  .row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    color: var(--text-dim);
  }
  .lib-row.current .row-icon {
    color: #9dc0ff;
  }
  .tick {
    display: flex;
    align-items: center;
    color: #9dc0ff;
  }
  .col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .row-name {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-path {
    font-size: 10px;
    color: var(--text-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more {
    display: flex;
    align-items: center;
    color: var(--text-faint);
    padding: 3px;
    border-radius: 5px;
    opacity: 0;
  }
  .lib-row:hover .more {
    opacity: 1;
  }
  .more:hover {
    background: var(--border);
    color: var(--text);
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 6px 4px;
  }

  .action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text);
    font-size: 13px;
  }
  .action :global(svg) {
    color: var(--text-dim);
  }
  .action:hover:not(:disabled) {
    background: var(--bg-elev-2);
  }
  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .create {
    padding: 4px;
  }
  .create input {
    width: 100%;
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    outline: none;
    margin-bottom: 6px;
  }
  .create input:focus {
    border-color: var(--accent);
  }
  .create-actions {
    display: flex;
    gap: 6px;
  }
  .mini {
    flex: 1;
    padding: 7px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    font-weight: 600;
    font-size: 12px;
  }
  .mini:hover {
    background: #34343c;
  }
  .mini.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .mini.primary:hover {
    background: #2f74e6;
  }
  .mini:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
