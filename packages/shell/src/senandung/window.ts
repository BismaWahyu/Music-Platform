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
