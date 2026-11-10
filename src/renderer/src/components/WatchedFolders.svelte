<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { watchedFolders, watchedOpen, addWatchedFolder, removeWatchedFolder, loadWatched } from '../lib/store'
  import Icon from './Icon.svelte'

  let busy = $state(false)

  async function add() {
    if (busy) return
    busy = true
    try {
      await addWatchedFolder()
    } finally {
      busy = false
    }
  }
  function close() {
    watchedOpen.set(false)
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  onMount(() => {
    loadWatched()
    window.addEventListener('keydown', onKey)
  })
  onDestroy(() => window.removeEventListener('keydown', onKey))
</script>

<div class="backdrop" onclick={close} role="presentation">
  <div class="panel" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-label="Auto Import" tabindex="-1">
    <div class="head">
      <div class="title"><Icon name="refresh" size={16} /><span>Auto Import</span></div>
      <button class="close" onclick={close} aria-label="Close"><Icon name="x" size={16} /></button>
    </div>
    <p class="intro">
      New files that appear in these folders are copied into this library automatically, even ones that
      arrive while DyskFiles is closed. Files already in a folder when you add it are left alone.
    </p>
    <div class="list">
      {#each $watchedFolders as dir (dir)}
        <div class="row">
          <Icon name="folder" size={15} />
          <span class="path" title={dir}>{dir}</span>
          <button class="remove" onclick={() => removeWatchedFolder(dir)} title="Stop watching" aria-label="Stop watching {dir}">
            <Icon name="x" size={14} />
          </button>
        </div>
      {:else}
        <p class="none">No watched folders yet.</p>
      {/each}
    </div>
    <div class="foot">
      <button class="primary" onclick={add} disabled={busy}><Icon name="plus" size={14} /> Add Folder…</button>
    </div>
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
    width: 560px;
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
    font-weight: 600;
  }
  .close,
  .remove {
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
  .close:hover,
  .remove:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .intro {
    margin: 0;
    padding: 12px 16px 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-dim);
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 10px;
    border-radius: 8px;
    color: var(--text-dim);
  }
  .row:hover {
    background: var(--bg-elev-2);
  }
  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
    font-size: 13px;
    color: var(--text);
  }
  .none {
    margin: 10px 6px;
    font-size: 13px;
    color: var(--text-faint);
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
  .primary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    font-size: 13px;
  }
  .primary:disabled {
    opacity: 0.6;
  }
</style>
