import { useEffect, useState, type FormEvent } from 'react'
import { api, TYPES, type MediaItem, type MediaType, type TmdbDetails } from '../api'
import { TmdbSearch } from './TmdbSearch'

interface Props {
  item: MediaItem | null
  onClose: () => void
  onSaved: (item: MediaItem, isNew: boolean) => void
  onError: (e: unknown) => void
}

const WITH_EPISODES: MediaType[] = ['serie', 'anime', 'novela', 'documental', 'reality']

export function MediaForm({ item, onClose, onSaved, onError }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [type, setType] = useState<MediaType>(item?.type ?? 'pelicula')
  const [rating, setRating] = useState(String(item?.rating ?? ''))
  const [year, setYear] = useState(item?.year ? String(item.year) : '')
  const [genres, setGenres] = useState(item?.genres.join(', ') ?? '')
  const [episodes, setEpisodes] = useState(item?.episodes ? String(item.episodes) : '')
  const [seasons, setSeasons] = useState(item?.seasons ? String(item.seasons) : '')
  const [synopsis, setSynopsis] = useState(item?.synopsis ?? '')
  const [available, setAvailable] = useState(item?.available ?? true)
  const [poster, setPoster] = useState<ImageState>({
    url: item?.posterUrl ?? null,
    file: null,
    removed: false,
    tmdbPath: null,
  })
  const [backdrop, setBackdrop] = useState<ImageState>({
    url: item?.backdropUrl ?? null,
    file: null,
    removed: false,
    tmdbPath: null,
  })
  const [tmdbRef, setTmdbRef] = useState<string | null>(null)
  const [fromTmdb, setFromTmdb] = useState<TmdbDetails | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modo de carga: manual (formulario) o automático (búsqueda en TMDb).
  const [tmdb, setTmdb] = useState<{ enabled: boolean; language: string } | null>(null)
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  useEffect(() => {
    api
      .tmdbStatus()
      .then((s) => {
        setTmdb(s)
        if (s.enabled && !item) setMode('auto')
      })
      .catch(() => setTmdb({ enabled: false, language: 'es-ES' }))
  }, [item])

  const applyTmdb = (d: TmdbDetails) => {
    setTitle(d.title)
    setType(d.suggestedType)
    setRating(String(d.rating))
    setYear(d.year ? String(d.year) : '')
    setGenres(d.genres.join(', '))
    setEpisodes(d.episodes ? String(d.episodes) : '')
    setSeasons(d.seasons ? String(d.seasons) : '')
    setSynopsis(d.synopsis)
    // Si TMDb no tiene imagen, se conserva la actual.
    if (d.posterPath) setPoster({ url: d.posterPreview, file: null, removed: false, tmdbPath: d.posterPath })
    if (d.backdropPath) setBackdrop({ url: d.backdropPreview, file: null, removed: false, tmdbPath: d.backdropPath })
    setTmdbRef(d.ref)
    setFromTmdb(d)
    setMode('manual')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const form = new FormData()
    form.set('title', title)
    form.set('type', type)
    form.set('rating', rating || '0')
    form.set('year', year)
    form.set('genres', genres)
    form.set('episodes', WITH_EPISODES.includes(type) ? episodes : '')
    form.set('seasons', WITH_EPISODES.includes(type) ? seasons : '')
    form.set('synopsis', synopsis)
    form.set('available', String(available))
    if (poster.file) form.set('poster', poster.file)
    else if (poster.tmdbPath && !poster.removed) form.set('posterTmdb', poster.tmdbPath)
    if (backdrop.file) form.set('backdrop', backdrop.file)
    else if (backdrop.tmdbPath && !backdrop.removed) form.set('backdropTmdb', backdrop.tmdbPath)
    if (tmdbRef) form.set('tmdbRef', tmdbRef)
    form.set('removePoster', String(poster.removed))
    form.set('removeBackdrop', String(backdrop.removed))
    try {
      const saved = item ? await api.update(item.id, form) : await api.create(form)
      onSaved(saved, !item)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      onError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <div className="modal-head">
          <h2>{item ? 'Editar título' : 'Nuevo título'}</h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            ✕
          </button>
        </div>

        {tmdb?.enabled && (
          <div className="mode-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              className={mode === 'manual' ? 'active' : ''}
              onClick={() => setMode('manual')}
            >
              ✍️ Manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'auto'}
              className={mode === 'auto' ? 'active' : ''}
              onClick={() => setMode('auto')}
            >
              ⚡ Automático (TMDb)
            </button>
          </div>
        )}
        {tmdb && !tmdb.enabled && !item && (
          <p className="muted small">
            Autocompletado desactivado: agrega <code>TMDB_TOKEN</code> al <code>.env</code> del servidor para buscar
            títulos en TMDb.
          </p>
        )}

        {mode === 'auto' && tmdb?.enabled ? (
          <TmdbSearch
            initialQuery={title}
            defaultLanguage={tmdb.language}
            currentId={item?.id}
            onPick={applyTmdb}
            onError={onError}
          />
        ) : (
          <>
            {fromTmdb && (
              <div className="tmdb-note">
                ⚡ Datos cargados desde TMDb
                {fromTmdb.originalTitle && fromTmdb.originalTitle !== fromTmdb.title
                  ? ` (${fromTmdb.originalTitle})`
                  : ''}
                . Revisa y pulsa <strong>Guardar</strong>; las imágenes se descargan al guardar.
                {fromTmdb.synopsisLanguage.startsWith('en') && ' La sinopsis está en inglés (no hay traducción).'}
                {fromTmdb.imdbUrl && (
                  <>
                    {' '}
                    <a href={fromTmdb.imdbUrl} target="_blank" rel="noreferrer">
                      Ver en IMDb
                    </a>
                  </>
                )}
              </div>
            )}
            <div className="form-grid">
              <div className="images">
                <ImagePicker label="Póster (vertical)" ratio="2 / 3" state={poster} onChange={setPoster} />
                <ImagePicker
                  label="Fondo (horizontal, opcional)"
                  ratio="16 / 9"
                  state={backdrop}
                  onChange={setBackdrop}
                />
              </div>

              <div className="fields">
                <label>
                  Nombre *
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus />
                </label>

                <div className="field-row">
                  <label>
                    Tipo *
                    <select value={type} onChange={(e) => setType(e.target.value as MediaType)}>
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.icon} {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Valoración (0–10)
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    />
                  </label>
                  <label>
                    Año
                    <input type="number" min={1888} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
                  </label>
                </div>

                {WITH_EPISODES.includes(type) && (
                  <div className="field-row">
                    <label>
                      Capítulos
                      <input type="number" min={0} value={episodes} onChange={(e) => setEpisodes(e.target.value)} />
                    </label>
                    <label>
                      Temporadas
                      <input type="number" min={0} value={seasons} onChange={(e) => setSeasons(e.target.value)} />
                    </label>
                  </div>
                )}

                <label>
                  Géneros (separados por coma)
                  <input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Acción, Drama" />
                </label>

                <label>
                  Sinopsis
                  <textarea rows={5} value={synopsis} onChange={(e) => setSynopsis(e.target.value)} maxLength={5000} />
                </label>

                <label className="check">
                  <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
                  Disponible para los clientes
                </label>
              </div>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={saving || !title.trim() || mode === 'auto'}>
            {saving ? (poster.tmdbPath || backdrop.tmdbPath ? 'Descargando imágenes…' : 'Guardando…') : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface ImageState {
  url: string | null
  file: File | null
  removed: boolean
  /** Ruta de la imagen en TMDb; el servidor la descarga al guardar. */
  tmdbPath: string | null
}

function ImagePicker({
  label,
  ratio,
  state,
  onChange,
}: {
  label: string
  ratio: string
  state: ImageState
  onChange: (s: ImageState) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!state.file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(state.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [state.file])

  const shown = preview ?? (state.removed ? null : state.url)

  return (
    <div className="image-picker">
      <span className="label">{label}</span>
      <label className="drop" style={{ aspectRatio: ratio }}>
        {shown ? <img src={shown} alt="" /> : <span className="muted small">Clic para subir imagen</span>}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange({ ...state, file, removed: false, tmdbPath: null })
            e.target.value = ''
          }}
        />
      </label>
      {shown && (
        <button
          type="button"
          className="btn ghost small"
          onClick={() => onChange({ ...state, file: null, removed: true, tmdbPath: null })}
        >
          Quitar imagen
        </button>
      )}
    </div>
  )
}
