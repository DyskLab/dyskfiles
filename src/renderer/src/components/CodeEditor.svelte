<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView, keymap } from '@codemirror/view'
  import { EditorState } from '@codemirror/state'
  import { basicSetup } from 'codemirror'
  import { oneDark } from '@codemirror/theme-one-dark'
  import { javascript } from '@codemirror/lang-javascript'
  import { json } from '@codemirror/lang-json'
  import { html } from '@codemirror/lang-html'
  import { css } from '@codemirror/lang-css'
  import { markdown } from '@codemirror/lang-markdown'
  import { xml } from '@codemirror/lang-xml'
  import { openId, updateItemMeta } from '../lib/store'
  import Icon from './Icon.svelte'

  let { item }: { item: RakItem } = $props()

  let editorEl = $state<HTMLElement>()
  let view: EditorView | null = null
  let dirty = $state(false)
  let saving = $state(false)
  let loadError = $state(false)

  const LANG_LABEL: Record<string, string> = {
    js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    ts: 'TypeScript', tsx: 'TypeScript', json: 'JSON', html: 'HTML', htm: 'HTML',
    css: 'CSS', scss: 'SCSS', less: 'Less', md: 'Markdown', markdown: 'Markdown',
    xml: 'XML', svg: 'XML', yml: 'YAML', yaml: 'YAML', py: 'Python', sql: 'SQL'
  }
  const langLabel = $derived(LANG_LABEL[item.ext] ?? item.ext.toUpperCase())

  function langExt(ext: string) {
    switch (ext) {
      case 'js': case 'jsx': case 'mjs': case 'cjs':
        return javascript({ jsx: ext === 'jsx' })
      case 'ts': case 'tsx':
        return javascript({ typescript: true, jsx: ext === 'tsx' })
      case 'json':
        return json()
      case 'html': case 'htm':
        return html()
      case 'css': case 'scss': case 'less':
        return css()
      case 'md': case 'markdown':
        return markdown()
      case 'xml': case 'svg':
        return xml()
      default:
        return []
    }
  }

  async function save() {
    if (!view || saving || !dirty) return
    saving = true
    try {
      const updated = await window.rak.writeText(item.id, view.state.doc.toString())
      if (updated) updateItemMeta(item.id, {}) // no-op patch keeps store item fresh via reload elsewhere
      dirty = false
    } finally {
      saving = false
    }
  }

  function close() {
    openId.set(null)
  }
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape' && !dirty) {
      close()
    }
  }

  onMount(async () => {
    window.addEventListener('keydown', onKey)
    const content = (await window.rak.readText(item.id)) ?? ''
    if (content === null) loadError = true
    view = new EditorView({
      parent: editorEl,
      state: EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          langExt(item.ext),
          oneDark,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) dirty = true
          })
        ]
      })
    })
  })
  onDestroy(() => {
    window.removeEventListener('keydown', onKey)
    view?.destroy()
  })
</script>

<div class="overlay">
  <div class="window">
    <div class="titlebar">
      <div class="left">
        <Icon name="note" size={15} />
        <span class="fname">{item.name}.{item.ext}</span>
        {#if dirty}<span class="dot" title="Unsaved changes"></span>{/if}
        <span class="lang">{langLabel}</span>
      </div>
      <div class="right">
        <button class="save" onclick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : dirty ? 'Save (⌘S)' : 'Saved'}
        </button>
        <button class="close" onclick={close} title="Close"><Icon name="x" size={16} /></button>
      </div>
    </div>
    {#if loadError}
      <div class="err">Could not read this file.</div>
    {/if}
    <div class="editorwrap" bind:this={editorEl}></div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5vh 5vw;
  }
  .window {
    width: 100%;
    height: 100%;
    max-width: 1100px;
    display: flex;
    flex-direction: column;
    background: #282c34;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
  }
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #21252b;
    border-bottom: 1px solid #181a1f;
    flex-shrink: 0;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #abb2bf;
    min-width: 0;
  }
  .fname {
    font-size: 13px;
    font-weight: 600;
    color: #e6e6e6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e5c07b;
    flex-shrink: 0;
  }
  .lang {
    font-size: 11px;
    color: #7f848e;
    border: 1px solid #3a3f4b;
    border-radius: 4px;
    padding: 1px 6px;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .save {
    padding: 6px 12px;
    background: var(--accent);
    border: none;
    border-radius: 7px;
    color: #fff;
    font-weight: 600;
    font-size: 12px;
  }
  .save:disabled {
    background: #3a3f4b;
    color: #7f848e;
    cursor: default;
  }
  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: #abb2bf;
  }
  .close:hover {
    background: #3a3f4b;
    color: #fff;
  }
  .err {
    padding: 10px 14px;
    color: #ff8080;
    font-size: 13px;
  }
  .editorwrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .editorwrap :global(.cm-editor) {
    height: 100%;
  }
  .editorwrap :global(.cm-scroller) {
    overflow: auto;
    font-family: 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: 13px;
  }
</style>
