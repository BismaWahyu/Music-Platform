// Tauri window controls. Safe no-ops when running in a plain browser (vite dev).
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function appWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

export async function winMinimize() {
  if (!inTauri) return
  try { (await appWindow()).minimize() } catch (e) { console.error(e) }
}

export async function winToggleMaximize() {
  if (!inTauri) return
  try { (await appWindow()).toggleMaximize() } catch (e) { console.error(e) }
}

export async function winClose() {
  if (!inTauri) return
  try { (await appWindow()).close() } catch (e) { console.error(e) }
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!inTauri) return false
  try { return await (await appWindow()).isMaximized() } catch { return false }
}

/** Subscribe to window resize/maximize changes. Returns an unsubscribe fn. */
export async function onWindowResized(cb: () => void): Promise<() => void> {
  if (!inTauri) return () => {}
  try { return await (await appWindow()).onResized(() => cb()) } catch { return () => {} }
}

// ---- PiP-style mini mode: a compact, always-on-top window. ----
const NORMAL_SIZE = { width: 1400, height: 900 }
const MINI_SIZE = { width: 400, height: 150 }

export async function enterMiniWindow() {
  if (!inTauri) return
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const w = await appWindow()
    if (await w.isMaximized()) await w.unmaximize()
    await w.setResizable(false)
    await w.setAlwaysOnTop(true)
    await w.setSize(new LogicalSize(MINI_SIZE.width, MINI_SIZE.height))
  } catch (e) { console.error(e) }
}

export async function exitMiniWindow() {
  if (!inTauri) return
  try {
    const { LogicalSize } = await import('@tauri-apps/api/dpi')
    const w = await appWindow()
    await w.setAlwaysOnTop(false)
    await w.setResizable(true)
    await w.setSize(new LogicalSize(NORMAL_SIZE.width, NORMAL_SIZE.height))
    await w.center()
  } catch (e) { console.error(e) }
}
