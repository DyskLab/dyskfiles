<script lang="ts">
  import { items, trash, view, setView, searchOpen, sidebarCollapsed, type View } from '../lib/store'
  import Icon from './Icon.svelte'
  import AddMenu from './AddMenu.svelte'

  const nav: { key: View; icon: string; label: string; count?: () => number }[] =
    $derived([
      { key: 'all', icon: 'grid', label: 'All', count: () => $items.length },
      { key: 'uncategorized', icon: 'inbox', label: 'Uncategorized' },
      { key: 'untagged', icon: 'tag', label: 'Untagged' },
      { key: 'recent', icon: 'clock', label: 'Recently Used' },
      { key: 'random', icon: 'shuffle', label: 'Random' },
      { key: 'trash', icon: 'trash', label: 'Trash', count: () => $trash.length }
    ])
</script>

<aside class="mini">
  <div class="titlebar drag"></div>

  <div class="railtools">
    <button class="tool" title="Expand sidebar" onclick={() => sidebarCollapsed.set(false)}>
      <Icon name="sidebar" size={16} />
    </button>
    <AddMenu />
    <button class="tool" title="Search (⌘F)" onclick={() => searchOpen.set(true)}>
      <Icon name="search" size={16} />
    </button>
  </div>

  <div class="rdiv"></div>

  <nav class="nav">
    {#each nav as item (item.key)}
      <button
        class="nav-item"
        class:active={$view === item.key}
        title={item.count ? `${item.label} (${item.count()})` : item.label}
        onclick={() => setView(item.key)}
      >
        <Icon name={item.icon} size={18} />
      </button>
    {/each}
  </nav>
</aside>

<style>
  .mini {
    background: var(--sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    /* visible so the Add menu can overflow onto the content area */
    overflow: visible;
    position: relative;
    z-index: 20;
  }

  .titlebar {
    height: var(--titlebar-h);
    width: 100%;
    flex-shrink: 0;
  }

  .railtools {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 2px 0 6px;
  }
  .tool {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 30px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--text-dim);
  }
  .tool:hover {
    background: var(--bg-elev);
    color: var(--text);
  }

  .rdiv {
    width: 40px;
    height: 1px;
    background: var(--border);
    margin: 2px 0 6px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    overflow-y: auto;
  }
  .nav-item {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 38px;
    border-radius: 9px;
    background: transparent;
    border: none;
    color: var(--text-dim);
  }
  button.nav-item:hover {
    background: var(--bg-elev);
    color: var(--text);
  }
  button.nav-item.active,
  button.nav-item.active:hover {
    background: var(--accent-soft);
    color: #9dc0ff;
  }
</style>
