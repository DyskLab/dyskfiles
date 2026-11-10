<script lang="ts">
  import { onMount } from 'svelte'
  import {
    library,
    items,
    trash,
    view,
    selectedId,
    openId,
    loading,
    searchOpen,
    sidebarCollapsed,
    showInspector,
    inspectorPinned,
    duplicatesOpen,
    watchedOpen,
    eagleProgress,
    filterBarOpen,
    useLibrary,
    loadPrefs,
    markItemUsed
  } from './lib/store'
  import Welcome from './components/Welcome.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import SidebarMini from './components/SidebarMini.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import FilterBar from './components/FilterBar.svelte'
  import Grid from './components/Grid.svelte'
  import TagsPage from './components/TagsPage.svelte'
  import Inspector from './components/Inspector.svelte'
  import SearchPalette from './components/SearchPalette.svelte'
  import CodeEditor from './components/CodeEditor.svelte'
  import Lightbox from './components/Lightbox.svelte'
  import MediaPlayer from './components/MediaPlayer.svelte'
  import Duplicates from './components/Duplicates.svelte'
  import PdfViewer from './components/PdfViewer.svelte'
  import FontViewer from './components/FontViewer.svelte'
  import WatchedFolders from './components/WatchedFolders.svelte'

  const openItem = $derived(
    $openId ? ([...$items, ...$trash].find((i) => i.id === $openId) ?? null) : null
  )

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      if ($library) searchOpen.set(true)
    }
  }

  onMount(async () => {
    loading.set(true)
    await loadPrefs()
    const lib = await window.rak.getCurrentLibrary()
    if (lib) await useLibrary(lib)
    loading.set(false)
  })

  $effect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Stamp "last used" whenever an item is opened (viewer/editor/player).
  let lastTouched: string | null = null
  $effect(() => {
    const id = $openId
    if (id && id !== lastTouched) {
      lastTouched = id
      markItemUsed(id)
    }
  })
</script>

{#if !$library}
  <Welcome />
{:else}
  {@const inspectorOpen = ($selectedId || $inspectorPinned) && $showInspector}
  <div
    class="app"
    class:with-inspector={inspectorOpen}
    class:sidebar-collapsed={$sidebarCollapsed}
  >
    {#if $sidebarCollapsed}
      <SidebarMini />
    {:else}
      <Sidebar />
    {/if}
    <main class="content">
      <Toolbar />
      {#if $view === 'alltags'}
        <TagsPage />
      {:else}
        {#if $filterBarOpen}
          <FilterBar />
        {/if}
        <Grid />
      {/if}
    </main>
    {#if inspectorOpen}
      <Inspector />
    {/if}
  </div>

  {#if $searchOpen}
    <SearchPalette />
  {/if}

  {#if $duplicatesOpen}
    <Duplicates />
  {/if}

  {#if $watchedOpen}
    <WatchedFolders />
  {/if}

  {#if $eagleProgress}
    <div class="progress-toast" role="status">
      <span>Importing from Eagle… {$eagleProgress.done} / {$eagleProgress.total}</span>
      <span class="progress-track"><span class="progress-fill" style="width:{$eagleProgress.total ? (100 * $eagleProgress.done) / $eagleProgress.total : 0}%"></span></span>
    </div>
  {/if}

  {#if openItem?.kind === 'text'}
    <CodeEditor item={openItem} />
  {:else if openItem?.kind === 'video' || openItem?.kind === 'audio'}
    <MediaPlayer item={openItem} />
  {:else if openItem?.kind === 'pdf'}
    {#key openItem.id}<PdfViewer item={openItem} />{/key}
  {:else if openItem?.kind === 'font'}
    {#key openItem.id}<FontViewer item={openItem} />{/key}
  {:else if openItem}
    <Lightbox item={openItem} />
  {/if}
{/if}

<style>
  .progress-toast {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 230;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 280px;
    padding: 12px 14px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    font-size: 13px;
  }
  .progress-track {
    height: 4px;
    background: var(--bg-elev-2);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.15s;
  }
</style>
