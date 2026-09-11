<script lang="ts" module>
  // Lucide-style monochrome line icons. Each entry is the inner markup of a
  // 24×24 stroke SVG (stroke = currentColor). Dots use an explicit fill.
  export const ICONS: Record<string, string> = {
    // ---- brand: ayam jago (rooster) ----
    chicken: `<g fill="currentColor" stroke="none"><path d="M6.5 6.6 7 4.3 8 5.9 8.8 3.9 9.6 5.7 10.6 4.3 11 6.6Z"/><circle cx="8.5" cy="8.6" r="2.7"/><polygon points="3.2,8.7 6,7.7 6,9.9"/><path d="M5.6 9.7c-.3 1.6 1.1 1.8 1.3 .3z"/><path d="M9 9.6c2.5-.7 5 .1 6.4 2.1 1.2 1.7 1.2 4 0 5.8-1.1 1.6-3 2.4-5 2.2-2.8-.3-4.8-2.4-4.8-5.2 0-2.2 1.3-4.1 3.4-4.9z"/><path d="M14.5 12c3.5.5 6.5-2 7-7-.7-.4-1.5-.2-2.1.4 .6 1.6 0 3.2-1.4 4.2-1-.8-2.2-.6-3 .2 .8 .6 .6 1.6-.5 2.2z"/><path d="M14 13c2.8.2 5-1.8 5.4-5-.8.6-1.6.8-2.4 1.6 .8 .4 .8 1.4 0 2-1 -.4-2 .2-3 1.4z"/></g><path d="M10 19.4v2.6M12.8 19.4v2.6M8.8 22h2.4M11.6 22h2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
    // ---- UI ----
    grid: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
    inbox: `<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
    restore: `<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>`,
    shuffle: `<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-2.5c-1.3 0-2.5-.6-3.3-1.7l-.5-.7"/><path d="m18 14 4 4-4 4"/>`,
    trash: `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>`,
    folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
    tag: `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".9" fill="currentColor" stroke="none"/>`,
    plus: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
    minus: `<path d="M5 12h14"/>`,
    chevron: `<path d="m6 9 6 6 6-6"/>`,
    'chevron-left': `<path d="m15 18-6-6 6-6"/>`,
    'chevron-right': `<path d="m9 18 6-6-6-6"/>`,
    crop: `<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>`,
    'rotate-cw': `<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>`,
    'flip-horizontal': `<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M12 2v20"/>`,
    maximize: `<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>`,
    expand: `<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>`,
    more: `<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/>`,
    refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`,
    reveal: `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
    image: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>`,
    x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
    check: `<path d="M20 6 9 17l-5-5"/>`,
    search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
    sidebar: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>`,
    sliders: `<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>`,
    filter: `<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>`,
    'sort-asc': `<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/><path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/>`,
    'sort-desc': `<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/>`,
    'smart-folder': `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/><path d="m12 10 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none"/>`,
    // ---- library picker ----
    camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
    star: `<path d="M11.5 2.5a.55.55 0 0 1 1 0l2.6 5.27 5.82.85a.55.55 0 0 1 .3.94l-4.2 4.1 1 5.8a.55.55 0 0 1-.8.58L12 17.34 6.78 20.1a.55.55 0 0 1-.8-.58l1-5.8-4.2-4.1a.55.55 0 0 1 .3-.94l5.82-.85z"/>`,
    flame: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
    bookmark: `<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>`,
    heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/>`,
    box: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>`,
    palette: `<circle cx="13.5" cy="6.5" r=".9" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r=".9" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r=".9" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r=".9" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.83-.44-1.12-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h1.99c3.05 0 5.56-2.5 5.56-5.55C21.96 6.01 17.46 2 12 2z"/>`,
    moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>`,
    // ---- filter criteria ----
    droplet: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`,
    sparkles: `<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="M19 3v3"/><path d="M20.5 4.5h-3"/>`,
    shapes: `<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>`,
    ruler: `<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/>`,
    'hard-drive': `<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/>`,
    type: `<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>`,
    message: `<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>`,
    note: `<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/>`,
    link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
    calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>`,
    film: `<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/>`,
    music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
    play: `<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>`,
    pin: `<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>`,
    code: `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`
  }
</script>

<script lang="ts">
  let { name, size = 18, strokeWidth = 2 }: { name: string; size?: number; strokeWidth?: number } =
    $props()
</script>

{#if ICONS[name]}
  <svg
    class="icon"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true">{@html ICONS[name]}</svg>
{:else}
  <!-- Fallback for legacy/emoji icon values so old libraries still render. -->
  <span class="fallback" style="font-size:{size * 0.85}px">{name}</span>
{/if}

<style>
  .icon {
    display: block;
    flex-shrink: 0;
  }
  .fallback {
    line-height: 1;
  }
</style>
