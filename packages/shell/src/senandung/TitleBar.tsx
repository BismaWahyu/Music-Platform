import { useEffect, useRef, useState } from 'react'
import { useSenandung } from './store'
import { Hover } from './Hover'
import { WinMin, WinMax, WinRestore, WinClose, NavSearch } from './Icons'
import { winMinimize, winToggleMaximize, winClose, isWindowMaximized, onWindowResized } from './window'

const btn = {
  width: '46px', height: '44px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#9398a0', cursor: 'pointer',
} as const

// Global search box living in the title bar — always available.
function TopSearch() {
  const query = useSenandung((s) => s.query)
  const setQuery = useSenandung((s) => s.setQuery)
  const runSearch = useSenandung((s) => s.runSearch)
  const clearSearch = useSenandung((s) => s.clearSearch)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [focused, setFocused] = useState(false)

  const onType = (value: string) => {
    setQuery(value) // controlled value + switches to the search view
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void runSearch(value), 300)
  }
  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    clearSearch()
    inputRef.current?.focus()
  }

  return (
    // stop mousedown from reaching the title bar's drag region (which would otherwise
    // start a window drag and swallow clicks on the input / clear button).
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%', maxWidth: '460px', height: '30px',
        padding: '0 10px', borderRadius: '9px',
        background: focused ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${focused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ color: '#9398a0', display: 'flex', flex: 'none' }}><NavSearch /></span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Cari lagu, artis, atau album"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#e8e9ea', fontSize: '13px' }}
      />
      {query && (
        <div onClick={clear} title="Bersihkan pencarian" style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', color: '#9398a0', background: 'rgba(255,255,255,0.08)' }}>
          <WinClose size={9} />
        </div>
      )}
    </div>
  )
}

export function TitleBar() {
  const [maxed, setMaxed] = useState(false)

  // Keep the maximize/restore icon in sync with the actual window state.
  useEffect(() => {
    let unlisten = () => {}
    void isWindowMaximized().then(setMaxed)
    onWindowResized(() => { void isWindowMaximized().then(setMaxed) }).then((fn) => { unlisten = fn })
    return () => unlisten()
  }, [])

  return (
    <div
      data-tauri-drag-region
      style={{
        height: '44px', flex: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '16px', padding: '0 8px 0 16px',
        background: 'rgba(18,20,26,0.5)', backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: 'none', pointerEvents: 'none' }}>
        <div style={{ width: '13px', height: '13px', borderRadius: '4px', background: 'oklch(0.64 0.19 256)', transform: 'rotate(45deg)' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em' }}>Senandung</span>
      </div>

      <div data-tauri-drag-region style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <TopSearch />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winMinimize} title="Minimalkan"><WinMin /></Hover>
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winToggleMaximize} title={maxed ? 'Pulihkan' : 'Maksimalkan'}>{maxed ? <WinRestore /> : <WinMax />}</Hover>
        <Hover style={btn} hover={{ background: '#e23b3b', color: '#ffffff' }} onClick={winClose} title="Tutup"><WinClose /></Hover>
      </div>
    </div>
  )
}
