<script lang="ts">
  import { addItems, addFolder, addSmartFolder, findDuplicates } from '../lib/store'
  import Icon from './Icon.svelte'

  let open = $state(false)
  let busy = $state(false)
  let creating = $state(false)
  let folderName = $state('')
  let smart = $state(false)
  let smartName = $state('')
  let linking = $state(false)
  let linkUrl = $state('')
  let rootEl: HTMLElement

  function onWindowClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) close()
  }
  $effect(() => {
    if (open) {
      window.addEventListener('click', onWindowClick, true)
      return () => window.removeEventListener('click', onWindowClick, true)
    }
    return
  })
  function close() {
    open = false
    creating = false
    folderName = ''
    smart = false
    smartName = ''
    linking = false
    linkUrl = ''
  }
  async function confirmSmart() {
    const n = smartName.trim()
    if (n) await addSmartFolder(n)
    close()
  }

  async function importLink() {
    const u = linkUrl.trim()
    if (!u) return close()
    busy = true
    try {
      addItems(await window.rak.importUrl(u))
    } finally {
      busy = false
      close()
    }
  }

  async function run(kind: 'files' | 'folder', linked = false) {
    if (busy) return
    close()
    busy = true
    try {
      const fresh =
        kind === 'folder'
          ? await window.rak.importFolder(linked)
          : await window.rak.importDialog(linked)
      addItems(fresh)
    } finally {
      busy = false
    }
  }
  async function confirmFolder() {
    const n = folderName.trim()
    if (n) await addFolder(n)
    close()
  }
</script>

<div class="add-wrap" bind:this={rootEl}>
  <button class="tool" title="Add" onclick={() => (open = !open)} class:active={open}>
    <Icon name="plus" size={16} />
  </button>
  {#if open}
    <div class="add-menu">
      {#if creating}
        <div class="inline">
          <input
            bind:value={folderName}
            placeholder="Folder name"
            spellcheck="false"
            onkeydown={(e) => {
              if (e.key === 'Enter') confirmFolder()
              if (e.key === 'Escape') close()
            }}
          />
          <button class="mini primary" onclick={confirmFolder}>Create</button>
        </div>
      {:else}
        <button class="mi" onclick={() => (creating = true)}>
          <Icon name="folder" size={15} /> New Folder
        </button>
      {/if}
      {#if smart}
        <div class="inline">
          <input
            bind:value={smartName}
            placeholder="Smart folder name"
            spellcheck="false"
            onkeydown={(e) => {
              if (e.key === 'Enter') confirmSmart()
              if (e.key === 'Escape') close()
            }}
          />
          <button class="mini primary" onclick={confirmSmart}>Save</button>
        </div>
      {:else}
        <button class="mi" onclick={() => (smart = true)} title="Save current filters as a smart folder">
          <Icon name="smart-folder" size={15} /> New Smart Folder
        </button>
      {/if}

      <div class="sep"></div>

      <button class="mi" onclick={() => run('files')}>
        <Icon name="image" size={15} /> Import Files…
      </button>
      <button class="mi" onclick={() => run('folder')}>
        <Icon name="folder" size={15} /> Import from Folder(s)…
      </button>
      <button class="mi" onclick={() => run('files', true)} title="Reference files in place without copying them into the library">
        <Icon name="link" size={15} /> Link Files (Reference)…
      </button>
      <button class="mi" onclick={() => run('folder', true)} title="Reference a folder's files in place without copying">
        <Icon name="link" size={15} /> Link Folder (Reference)…
      </button>
      {#if linking}
        <div class="inline">
          <input
            bind:value={linkUrl}
            placeholder="https://…/image.png"
            spellcheck="false"
            onkeydown={(e) => {
              if (e.key === 'Enter') importLink()
              if (e.key === 'Escape') close()
            }}
          />
          <button class="mini primary" onclick={importLink}>Add</button>
        </div>
      {:else}
        <button class="mi" onclick={() => (linking = true)}>
          <Icon name="link" size={15} /> Import from Links…
        </button>
      {/if}
      <button class="mi" disabled>
        <Icon name="box" size={15} /> Import Eagle Package… <span class="soon">Soon</span>
      </button>
      <button class="mi" disabled>
        <Icon name="refresh" size={15} /> Auto Import <span class="soon">Soon</span>
      </button>
      <button class="mi" onclick={() => { close(); findDuplicates() }}>
        <Icon name="shapes" size={15} /> Find Duplicated Items
      </button>

      <div class="sep"></div>

      {#each ['Photoshop Document', 'Illustrator Document', 'XD Document'] as d}
        <button class="mi" disabled><Icon name="image" size={15} /> {d} <span class="soon">Soon</span></button>
      {/each}

      <div class="sep"></div>

      {#each ['Text Document', 'Word Document', 'PowerPoint Document', 'Excel Document', 'Keynote Document', 'Pages Document', 'Numbers Document'] as d}
        <button class="mi" disabled><Icon name="note" size={15} /> {d} <span class="soon">Soon</span></button>
      {/each}

      <div class="sep"></div>

      <button class="mi" disabled><Icon name="link" size={15} /> Pinterest <span class="soon">Soon</span></button>
      <button class="mi" disabled><Icon name="link" size={15} /> ArtStation <span class="soon">Soon</span></button>
    </div>
  {/if}
</div>

<style>
  .add-wrap {
    position: relative;
  }
  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 26px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text-dim);
  }
  .tool:hover,
  .tool.active {
    background: var(--bg-elev);
    color: var(--text);
  }
  .add-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 60;
    min-width: 240px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
  }
  .mi {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    text-align: left;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--text);
    font-size: 13px;
  }
  .mi:hover:not(:disabled) {
    background: var(--bg-elev-2);
  }
  .mi:disabled {
    color: var(--text-faint);
    cursor: default;
  }
  .mi :global(svg) {
    color: var(--text-dim);
  }
  .soon {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-faint);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
  }
  .sep {
    height: 1px;
    background: var(--border);
    margin: 6px 4px;
  }
  .inline {
    display: flex;
    gap: 6px;
    padding: 4px;
  }
  .inline input {
    flex: 1;
    min-width: 0;
    padding: 7px 9px;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 7px;
    color: var(--text);
    outline: none;
    font-size: 13px;
  }
  .mini {
    padding: 7px 10px;
    background: var(--accent);
    border: none;
    border-radius: 7px;
    color: #fff;
    font-weight: 600;
    font-size: 12px;
  }
</style>
