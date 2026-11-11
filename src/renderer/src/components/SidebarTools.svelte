<script lang="ts">
  import { shortcut } from '../lib/platform'
  import { searchOpen, sidebarCollapsed } from '../lib/store'
  import { tooltip } from '../lib/tooltip'
  import Icon from './Icon.svelte'
  import AddMenu from './AddMenu.svelte'
</script>

<div class="tools">
  <AddMenu />

  <button class="tool" use:tooltip={`Search (${shortcut('F')})`} aria-label="Search" onclick={() => searchOpen.set(true)}>
    <Icon name="search" size={16} />
  </button>

  <button class="tool" use:tooltip={'Collapse to mini sidebar'} aria-label="Collapse sidebar" onclick={() => sidebarCollapsed.set(true)}>
    <Icon name="sidebar" size={16} />
  </button>
</div>

<style>
  .tools {
    display: flex;
    align-items: center;
    gap: 2px;
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
  .tool:hover {
    background: var(--bg-elev);
    color: var(--text);
  }
</style>
