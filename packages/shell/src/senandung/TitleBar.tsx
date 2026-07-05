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
        placeholder="Search songs, artists, or albums"
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#e8e9ea', fontSize: '13px' }}
      />
      {query && (
        <div onClick={clear} title="Clear search" style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', cursor: 'pointer', color: '#9398a0', background: 'rgba(255,255,255,0.08)' }}>
          <WinClose size={9} />
        </div>
      )}
    </div>
  )
}

// Small amber "Offline" pill shown in the title bar when there's no connection.
function OfflinePill() {
  return (
    <div title="No internet connection" style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '24px', padding: '0 10px', marginRight: '6px', borderRadius: '12px', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)', color: '#f0b45a', fontSize: '11.5px', fontWeight: 600 }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f0b45a' }} />
      Offline
    </div>
  )
}

export function TitleBar() {
  const [maxed, setMaxed] = useState(false)
  const online = useSenandung((s) => s.online)

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 'none', pointerEvents: 'none' }}>
        <img src="/SwayTuneDark.png" alt="" width={19} height={19} style={{ borderRadius: '5px', display: 'block' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em' }}>SwayTune</span>
      </div>

      <div data-tauri-drag-region style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <TopSearch />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>
        {!online && <OfflinePill />}
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winMinimize} title="Minimize"><WinMin /></Hover>
        <Hover style={btn} hover={{ background: 'rgba(255,255,255,0.07)', color: '#e8e9ea' }} onClick={winToggleMaximize} title={maxed ? 'Restore' : 'Maximize'}>{maxed ? <WinRestore /> : <WinMax />}</Hover>
        <Hover style={btn} hover={{ background: '#e23b3b', color: '#ffffff' }} onClick={winClose} title="Close"><WinClose /></Hover>
      </div>
    </div>
  )
}
