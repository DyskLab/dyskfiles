// Platform-specific wording for the UI (DyskFiles runs on macOS and Windows).
export const isMac = window.rak.platform === 'darwin'
/** "Reveal in Finder" on macOS, "Show in Explorer" on Windows. */
export const revealLabel = isMac ? 'Reveal in Finder' : 'Show in Explorer'
/** Shortcut text for the command key: "⌘F" on macOS, "Ctrl+F" on Windows. */
export const shortcut = (key: string): string => (isMac ? `⌘${key}` : `Ctrl+${key}`)
