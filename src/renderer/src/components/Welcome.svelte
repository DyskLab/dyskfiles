<script lang="ts">
  import { useLibrary } from '../lib/store'
  import { LOGO_DATA_URL } from '../lib/logo'

  let name = $state('My Library')
  let busy = $state(false)

  async function create() {
    if (busy) return
    busy = true
    try {
      const lib = await window.rak.createLibrary(name)
      if (lib) await useLibrary(lib)
    } finally {
      busy = false
    }
  }

  async function open() {
    if (busy) return
    busy = true
    try {
      const lib = await window.rak.openLibrary()
      if (lib) await useLibrary(lib)
    } finally {
      busy = false
    }
  }
</script>

<div class="welcome drag">
  <div class="card no-drag">
    <div class="logo"><img src={LOGO_DATA_URL} alt="DyskFiles" /></div>
    <h1>DyskFiles</h1>
    <p class="tagline">An Eagle-style asset library. Everything lives in one tidy folder.</p>

    <label class="field">
      <span>Library name</span>
      <input type="text" bind:value={name} placeholder="My Library" spellcheck="false" />
    </label>

    <div class="actions">
      <button class="btn primary" onclick={create} disabled={busy}>Create Library</button>
      <button class="btn" onclick={open} disabled={busy}>Open Library…</button>
    </div>

    <p class="hint">
      Creates a <code>&lt;name&gt;.dyskfiles</code> folder with <code>items/</code>,
      <code>originals/</code> and <code>thumbnails/</code>.
    </p>
    <a class="support" href="https://buymeacoffee.com/fannydevz" target="_blank" rel="noopener">Support DyskFiles</a>
  </div>
</div>

<style>
  .welcome {
    height: 100vh;
    display: grid;
    place-items: center;
    background:
      radial-gradient(1200px 600px at 50% -10%, rgba(59, 130, 246, 0.12), transparent 60%),
      var(--bg);
  }

  .card {
    width: 380px;
    padding: 34px 32px 26px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  }

  .logo {
    display: flex;
    justify-content: center;
  }
  .logo img {
    width: 72px;
    height: 72px;
    border-radius: 16px;
  }

  h1 {
    margin: 12px 0 4px;
    font-size: 26px;
    letter-spacing: -0.5px;
  }

  .tagline {
    margin: 0 0 22px;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .field {
    display: block;
    text-align: left;
    margin-bottom: 18px;
  }
  .field span {
    display: block;
    color: var(--text-dim);
    margin-bottom: 6px;
    font-size: 12px;
  }
  .field input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    outline: none;
  }
  .field input:focus {
    border-color: var(--accent);
  }

  .actions {
    display: flex;
    gap: 10px;
  }
  .btn {
    flex: 1;
    padding: 11px 14px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-weight: 600;
  }
  .btn:hover {
    background: #34343c;
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .btn.primary:hover {
    background: #2f74e6;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .hint {
    margin: 18px 0 0;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.6;
  }
  .support {
    display: inline-block;
    margin-top: 12px;
    font-size: 12px;
    color: var(--text-dim);
  }
  .support:hover {
    color: var(--text);
  }
  code {
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
  }
</style>
