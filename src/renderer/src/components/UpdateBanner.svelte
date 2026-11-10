<script lang="ts">
  import { onDestroy } from 'svelte'
  import { updateInfo } from '../lib/store'
  import Icon from './Icon.svelte'

  let { info }: { info: RakUpdateInfo } = $props()

  type Phase = 'available' | 'downloading' | 'ready' | 'error'
  let phase = $state<Phase>('available')
  let received = $state(0)
  let total = $state(0)
  let error = $state('')

  const mb = (n: number): string =>
    n < 1024 * 1024
      ? `${Math.max(1, Math.round(n / 1024))} KB`
      : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`

  // Release notes as plain text: drop Markdown markers, keep the first lines.
  const notes = $derived(
    info.notes
      .split('\n')
      .map((l) =>
        l
          .replace(/^#{1,6}\s*/, '')
          .replace(/^\s*[-*]\s+/, '• ')
          .replace(/\*\*|__|`/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .trimEnd()
      )
      .filter((l, i, all) => l || (i > 0 && all[i - 1]))
      .slice(0, 12)
      .join('\n')
      .trim()
  )

  const stop = window.rak.onUpdateProgress((p) => {
    received = p.received
    total = p.total
  })
  onDestroy(stop)

  async function download() {
    phase = 'downloading'
    received = 0
    total = info.asset.size
    try {
      await window.rak.downloadUpdate()
      phase = 'ready'
    } catch (err) {
      error = (err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      phase = 'error'
    }
  }
  function later() {
    updateInfo.set(null)
  }
  async function skip() {
    await window.rak.skipUpdate(info.version)
    updateInfo.set(null)
  }
</script>

<div class="update" role="dialog" aria-label="Update available">
  <div class="head">
    <span class="badge"><Icon name="share" size={14} /></span>
    <div class="titles">
      {#if phase === 'ready'}
        <strong>Ready to install {info.version}</strong>
      {:else}
        <strong>DyskFiles {info.version} is available</strong>
        <span>You have {info.current}.</span>
      {/if}
    </div>
    {#if phase !== 'downloading'}
      <button class="x" onclick={later} aria-label="Close"><Icon name="x" size={14} /></button>
    {/if}
  </div>

  {#if phase === 'available'}
    {#if notes}<pre class="notes">{notes}</pre>{/if}
    <a class="link" href={info.page} target="_blank" rel="noopener">Release notes on GitHub</a>
    <div class="actions">
      <button class="text" onclick={skip}>Skip This Version</button>
      <span class="grow"></span>
      <button onclick={later}>Later</button>
      <button class="primary" onclick={download}>Download ({mb(info.asset.size)})</button>
    </div>
  {:else if phase === 'downloading'}
    <div class="track"><span style="width:{total ? Math.min(100, (100 * received) / total) : 0}%"></span></div>
    <p class="status">Downloading… {mb(received)}{total ? ` of ${mb(total)}` : ''}</p>
  {:else if phase === 'ready'}
    <p class="status">
      The disk image is open and saved in Downloads. Quit DyskFiles, then drag the new DyskFiles onto Applications and
      choose Replace.
    </p>
    <div class="actions">
      <span class="grow"></span>
      <button onclick={later}>Later</button>
      <button class="primary" onclick={() => window.rak.quitForUpdate()}>Quit DyskFiles</button>
    </div>
  {:else}
    <p class="status err">{error}</p>
    <div class="actions">
      <a class="link" href={info.page} target="_blank" rel="noopener">Download from GitHub</a>
      <span class="grow"></span>
      <button onclick={later}>Later</button>
      <button class="primary" onclick={download}>Try Again</button>
    </div>
  {/if}
</div>

<style>
  .update {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 220;
    width: 360px;
    max-width: calc(100vw - 36px);
    padding: 14px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .titles {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .titles span {
    color: var(--text-dim);
    font-size: 12px;
  }
  .x {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-dim);
  }
  .x:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .notes {
    margin: 0;
    max-height: 132px;
    overflow-y: auto;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg);
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }
  .link {
    color: var(--accent);
    font-size: 12px;
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .grow {
    flex: 1;
  }
  .actions button {
    padding: 6px 11px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--bg-elev-2);
    color: var(--text);
    font-size: 12px;
  }
  .actions button.primary {
    border-color: transparent;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }
  .actions button.text {
    padding: 6px 2px;
    border: none;
    background: transparent;
    color: var(--text-dim);
  }
  .actions button.text:hover {
    color: var(--text);
  }
  .track {
    height: 6px;
    border-radius: 3px;
    background: var(--bg-elev-2);
    overflow: hidden;
  }
  .track span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.15s;
  }
  .status {
    margin: 0;
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.5;
  }
  .status.err {
    color: #f87171;
  }
</style>
