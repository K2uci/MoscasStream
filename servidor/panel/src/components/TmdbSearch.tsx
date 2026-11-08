import { useState, type KeyboardEvent } from 'react'
import { api, typeInfo, type TmdbDetails, type TmdbResult } from '../api'

const LANGUAGES = [
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'es-MX', label: 'Español (Latinoamérica)' },
  { value: 'en-US', label: 'Inglés' },
]

interface Props {
  initialQuery: string
  defaultLanguage: string
  /** id del título que se está editando, para no marcarlo como duplicado de sí mismo. */
  currentId?: string
  onPick: (details: TmdbDetails) => void
  onError: (e: unknown) => void
}

/** Búsqueda en TMDb: escribe el nombre, elige una coincidencia y se rellenan los datos del formulario. */
export function TmdbSearch({ initialQuery, defaultLanguage, currentId, onPick, onError }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [year, setYear] = useState('')
  const [language, setLanguage] = useState(defaultLanguage)
  const [results, setResults] = useState<TmdbResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingRef, setLoadingRef] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (query.trim().length < 2) return
    setSearching(true)
    setError(null)
    try {
      setResults(await api.tmdbSearch(query.trim(), year, language))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar')
      onError(e)
    } finally {
      setSearching(false)
    }
  }

  const pick = async (r: TmdbResult) => {
    setLoadingRef(r.ref)
    setError(null)
    try {
      onPick(await api.tmdbDetails(r.kind, r.id, language))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
      onError(e)
    } finally {
      setLoadingRef(null)
    }
  }

  // Enter busca (sin enviar el formulario de guardar que envuelve a este componente).
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      search()
    }
  }

  return (
    <div className="tmdb">
      <div className="tmdb-bar">
        <input
          className="tmdb-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onEnter}
          placeholder="Nombre de la película o serie…"
          autoFocus
        />
        <input
          className="tmdb-year"
          type="number"
          min={1888}
          max={2100}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          onKeyDown={onEnter}
          placeholder="Año"
        />
        <select value={language} onChange={(e) => setLanguage(e.target.value)} title="Idioma de los datos">
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn primary" onClick={search} disabled={searching || query.trim().length < 2}>
          {searching ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {results && results.length === 0 && (
        <p className="muted">No se encontró nada. Prueba con otro nombre o sin año.</p>
      )}

      {results && results.length > 0 && (
        <>
          <p className="muted small">Elige la coincidencia correcta para rellenar el formulario:</p>
          <div className="tmdb-results">
            {results.map((r) => {
              const t = typeInfo(r.suggestedType)
              const duplicate = r.existingId && r.existingId !== currentId
              return (
                <button
                  type="button"
                  key={r.ref}
                  className="tmdb-result"
                  onClick={() => pick(r)}
                  disabled={loadingRef !== null}
                  title={r.overview}
                >
                  <div className="tmdb-poster" style={{ '--tint': t.tint } as React.CSSProperties}>
                    {r.posterPreview ? <img src={r.posterPreview} alt="" loading="lazy" /> : <span>{t.icon}</span>}
                    {loadingRef === r.ref && <div className="tmdb-loading">Cargando…</div>}
                  </div>
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    {r.year ?? '—'} · {r.kind === 'movie' ? 'Película' : 'Serie'} · ★ {r.rating.toFixed(1)}
                  </span>
                  {r.originalTitle && r.originalTitle !== r.title && (
                    <span className="muted small tmdb-original">{r.originalTitle}</span>
                  )}
                  {duplicate && <span className="tmdb-dup">Ya está en el catálogo</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
