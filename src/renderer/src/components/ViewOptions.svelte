<script lang="ts">
  import {
    layout,
    thumbQuality,
    sortKey,
    sortDir,
    itemInfoField,
    sidebarCollapsed,
    showInspector,
    showName,
    showItemInfo,
    showExtension,
    showExtensionLabel,
    showAnnotation,
    showSubfolderContents,
    refresh,
    type SortKey,
    type Layout,
    type InfoField
  } from '../lib/store'
  import Icon from './Icon.svelte'

  let open = $state(false)
  let rootEl: HTMLElement

  const LAYOUTS: { key: Layout; label: string }[] = [
    { key: 'waterfall', label: 'Waterfall' },
    { key: 'justified', label: 'Justified' },
    { key: 'grid', label: 'Grid' },
    { key: 'list', label: 'List' }
  ]
  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'dateModified', label: 'Date Modified' },
    { key: 'dateCreated', label: 'Date Created' },
    { key: 'title', label: 'Title' },
    { key: 'extension', label: 'Extension' },
    { key: 'size', label: 'File Size' },
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'rating', label: 'Rating' },
    { key: 'duration', label: 'Duration' }
  ]
  const INFO_FIELDS: { key: InfoField; label: string }[] = [
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'size', label: 'File Size' },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'extension', label: 'Extension' }
  ]

  function onWindowClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) open = false
  }
  $effect(() => {
    if (open) {
      window.addEventListener('click', onWindowClick, true)
      return () => window.removeEventListener('click', onWindowClick, true)
    }
    return
  })
</script>

<div class="wrap" bind:this={rootEl}>
  <button class="tool" title="View options" class:active={open} onclick={() => (open = !open)}>
    <Icon name="sliders" size={16} />
  </button>

  {#if open}
    <div class="panel">
      <div class="row">
        <span class="label">Layout</span>
        <div class="selwrap">
          <Icon name="grid" size={13} />
          <select bind:value={$layout}>
            {#each LAYOUTS as l (l.key)}<option value={l.key}>{l.label}</option>{/each}
          </select>
        </div>
      </div>

      <div class="row">
        <span class="label">Thumbnail</span>
        <div class="seg">
          <button class:on={$thumbQuality === 'speed'} onclick={() => thumbQuality.set('speed')}>Speed</button>
          <button class:on={$thumbQuality === 'quality'} onclick={() => thumbQuality.set('quality')}>Quality</button>
        </div>
      </div>

      <div class="row">
        <span class="label">Sort by</span>
        <div class="sortctl">
          <div class="selwrap">
            <Icon name="clock" size={13} />
            <select bind:value={$sortKey}>
              {#if $sortKey === 'custom'}<option value="custom">Custom</option>{/if}
              {#each SORTS as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
            </select>
          </div>
          <button class="dir" class:on={$sortDir === 'asc'} title="Ascending" onclick={() => sortDir.set('asc')}>
            <Icon name="sort-asc" size={15} />
          </button>
          <button class="dir" class:on={$sortDir === 'desc'} title="Descending" onclick={() => sortDir.set('desc')}>
            <Icon name="sort-desc" size={15} />
          </button>
        </div>
      </div>

      <div class="sep"></div>

      <button class="trow" onclick={() => showName.update((v) => !v)}>
        <span class="label">Show Name</span>
        <span class="switch" class:on={$showName}><span class="knob"></span></span>
      </button>

      <div class="trow static">
        <span class="label">Show item info</span>
        <div class="right">
          <div class="selwrap sm">
            <Icon name="grid" size={12} />
            <select bind:value={$itemInfoField}>
              {#each INFO_FIELDS as f (f.key)}<option value={f.key}>{f.label}</option>{/each}
            </select>
          </div>
          <button class="switch" class:on={$showItemInfo} onclick={() => showItemInfo.update((v) => !v)} aria-label="Toggle item info"><span class="knob"></span></button>
        </div>
      </div>

      <button class="trow" onclick={() => showExtension.update((v) => !v)}>
        <span class="label">Show extension</span>
        <span class="switch" class:on={$showExtension}><span class="knob"></span></span>
      </button>
      <button class="trow" onclick={() => showExtensionLabel.update((v) => !v)}>
        <span class="label">Show extension label</span>
        <span class="switch" class:on={$showExtensionLabel}><span class="knob"></span></span>
      </button>
      <button class="trow" onclick={() => showAnnotation.update((v) => !v)}>
        <span class="label">Show annotation</span>
        <span class="switch" class:on={$showAnnotation}><span class="knob"></span></span>
      </button>
      <button class="trow" onclick={() => showSubfolderContents.update((v) => !v)}>
        <span class="label">Show subfolder contents</span>
        <span class="switch" class:on={$showSubfolderContents}><span class="knob"></span></span>
      </button>

      <div class="sep"></div>

      <button class="trow" onclick={() => sidebarCollapsed.update((v) => !v)}>
        <span class="label">Show sidebar</span>
        <span class="switch" class:on={!$sidebarCollapsed}><span class="knob"></span></span>
      </button>
      <button class="trow" onclick={() => showInspector.update((v) => !v)}>
        <span class="label">Show inspector</span>
        <span class="switch" class:on={$showInspector}><span class="knob"></span></span>
      </button>

      <div class="sep"></div>

      <button class="refresh" onclick={() => refresh().then(() => (open = false))}>Refresh</button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
  }
  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
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

  .panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 60;
    width: 320px;
    max-height: 80vh;
    overflow-y: auto;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px;
  }
  .label {
    color: var(--text);
    font-size: 13px;
  }

  .selwrap {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-dim);
  }
  .selwrap.sm {
    padding: 3px 6px;
  }
  select {
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }

  .seg,
  .sortctl {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .seg {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }
  .seg button {
    padding: 4px 12px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
  }
  .seg button.on {
    background: var(--bg-elev-2);
    color: var(--text);
  }

  .dir {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-dim);
  }
  .dir.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #cfe0ff;
  }

  .sep {
    height: 1px;
    background: var(--border);
    margin: 6px 4px;
  }

  .trow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    text-align: left;
  }
  .trow:not(.static):hover {
    background: var(--bg-elev-2);
  }
  .trow .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .switch {
    width: 38px;
    height: 22px;
    border-radius: 999px;
    background: #3a3a44;
    border: none;
    position: relative;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .switch.on {
    background: var(--accent);
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .switch.on .knob {
    transform: translateX(16px);
  }

  .refresh {
    width: 100%;
    padding: 9px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-weight: 600;
    font-size: 13px;
  }
  .refresh:hover {
    background: #34343c;
  }
</style>
