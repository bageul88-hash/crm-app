import { useState, useRef, useCallback } from 'react'

export default function SearchInput({ value, onChange, placeholder = '이름 또는 전화번호 검색', style }) {
  const [inputVal, setInputVal] = useState(value || '')
  const composingRef = useRef(false)

  const handleChange = useCallback(e => {
    const v = e.target.value
    setInputVal(v)
    if (!composingRef.current) onChange(v)
  }, [onChange])

  const handleCompositionStart = useCallback(() => { composingRef.current = true }, [])
  const handleCompositionEnd = useCallback(e => {
    composingRef.current = false
    setInputVal(e.target.value)
    onChange(e.target.value)
  }, [onChange])

  return (
    <div className="search-box" style={style}>
      <span>🔍</span>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        placeholder={placeholder}
        value={inputVal}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      {inputVal && (
        <button
          type="button"
          onClick={() => { setInputVal(''); onChange('') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
        >✕</button>
      )}
    </div>
  )
}
