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

// ---- PiP-style mini mode: a compact, resizable, always-on-top window. ----
// Enter/exit + size/position/limits are handled in Rust (it can read the taskbar-aware
// work area). The default mini size below must fit the MiniPlayer card.
const MINI_SIZE = { width: 380, height: 412 }

async function invokeCmd(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

export async function enterMiniWindow() {
  if (!inTauri) return
  try { await invokeCmd('enter_mini_mode', { width: MINI_SIZE.width, height: MINI_SIZE.height }) } catch (e) { console.error(e) }
}

export async function exitMiniWindow() {
  if (!inTauri) return
  try { await invokeCmd('exit_mini_mode') } catch (e) { console.error(e) }
}

/** Start an interactive window resize from a mini-player edge/corner handle. */
export async function startResize(direction: string) {
  if (!inTauri) return
  try {
    const w = await appWindow()
    await (w.startResizeDragging as (d: string) => Promise<void>)(direction)
  } catch (e) { console.error(e) }
}
