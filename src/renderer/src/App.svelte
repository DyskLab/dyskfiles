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

  {#if openItem?.kind === 'text'}
    <CodeEditor item={openItem} />
  {:else if openItem?.kind === 'video' || openItem?.kind === 'audio'}
    <MediaPlayer item={openItem} />
  {:else if openItem}
    <Lightbox item={openItem} />
  {/if}
{/if}
