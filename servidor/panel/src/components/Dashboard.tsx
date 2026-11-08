import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, TYPES, typeInfo, UnauthorizedError, type MediaItem, type MediaType } from '../api'
import { MediaForm } from './MediaForm'

const PAGE_SIZE = 100

interface Props {
  user: string
  onLogout: () => void
  onUnauthorized: () => void
}

export function Dashboard({ user, onLogout, onUnauthorized }: Props) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | MediaType>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<MediaItem | 'new' | null>(null)
  // Con miles de títulos, la tabla se muestra por páginas para que el panel siga fluido.
  const [shown, setShown] = useState(PAGE_SIZE)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleError = useCallback(
    (e: unknown) => {
      if (e instanceof UnauthorizedError) onUnauthorized()
      else notify(e instanceof Error ? e.message : 'Error inesperado', true)
    },
    [notify, onUnauthorized],
  )

  const load = useCallback(async () => {
    try {
      setItems(await api.list())
    } catch (e) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    load()
  }, [load])

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (filter === 'all' || i.type === filter) &&
          (!q || i.title.toLowerCase().includes(q) || i.genres.some((g) => g.toLowerCase().includes(q))),
      ),
    [items, filter, q],
  )

  useEffect(() => setShown(PAGE_SIZE), [filter, q])

  const toggleAvailable = async (item: MediaItem) => {
    // Cambio optimista: se ve al instante y se revierte si falla.
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, available: !i.available } : i)))
    try {
      await api.setAvailable(item.id, !item.available)
    } catch (e) {
      setItems((list) => list.map((i) => (i.id === item.id ? item : i)))
      handleError(e)
    }
  }

  const remove = async (item: MediaItem) => {
    if (!confirm(`¿Eliminar "${item.title}" del catálogo? Esta acción no se puede deshacer.`)) return
    try {
      await api.remove(item.id)
      setItems((list) => list.filter((i) => i.id !== item.id))
      notify('Título eliminado')
    } catch (e) {
      handleError(e)
    }
  }

  const onSaved = (saved: MediaItem, isNew: boolean) => {
    setItems((list) => (isNew ? [saved, ...list] : list.map((i) => (i.id === saved.id ? saved : i))))
    setEditing(null)
    notify(isNew ? 'Título agregado' : 'Cambios guardados')
  }

  const tiles = [
    { key: 'all' as const, label: 'Todo', icon: '✨', tint: '#22D3A6', list: items },
    ...TYPES.map((t) => ({ key: t.value, label: t.label, icon: t.icon, tint: t.tint, list: items.filter((i) => i.type === t.value) })),
  ]

  const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname)

  return (
    <div className="layout">
      <header className="topbar">
        <h1 className="logo">
          Las Moscas<span>Stream</span> <small>Panel</small>
        </h1>
        <div className="topbar-right">
          <span className="muted">👤 {user}</span>
          <button className="btn ghost" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      <main className="content">
        <div className="hint">
          📱 Dirección para la app Android:{' '}
          {isLocalhost ? (
            <>
              <code>IP-de-tu-PC:{location.port || '80'}</code> (búscala con <code>ipconfig</code>)
            </>
          ) : (
            <code>{location.host}</code>
          )}
        </div>

        <section className="tiles">
          {tiles.map((t) => {
            const available = t.list.filter((i) => i.available).length
            return (
              <button
                key={t.key}
                className={`tile ${filter === t.key ? 'active' : ''}`}
                style={{ '--tint': t.tint } as React.CSSProperties}
                onClick={() => setFilter(filter === t.key && t.key !== 'all' ? 'all' : t.key)}
              >
                <div className="tile-top">
                  <span className="tile-icon">{t.icon}</span>
                  <span className="tile-total">{t.list.length}</span>
                </div>
                <div className="tile-label">{t.label}</div>
                <div className="muted small">{available} disponibles</div>
              </button>
            )
          })}
        </section>

        <section className="toolbar">
          <input
            className="search"
            placeholder="Buscar por título o género…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn primary" onClick={() => setEditing('new')}>
            + Nuevo título
          </button>
        </section>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : visible.length === 0 ? (
          <div className="empty card">
            <p>{items.length === 0 ? 'Aún no hay títulos en el catálogo.' : 'No hay títulos que coincidan.'}</p>
            {items.length === 0 && (
              <button className="btn primary" onClick={() => setEditing('new')}>
                Agregar el primero
              </button>
            )}
          </div>
        ) : (
          <div className="table card">
            <div className="row head">
              <span />
              <span>Título</span>
              <span>Tipo</span>
              <span>Capítulos</span>
              <span>Valoración</span>
              <span>Disponible</span>
              <span />
            </div>
            {visible.slice(0, shown).map((item) => {
              const t = typeInfo(item.type)
              return (
                <div key={item.id} className="row">
                  <div className="thumb" style={{ '--tint': t.tint } as React.CSSProperties}>
                    {item.posterUrl ? (
                      <img src={item.thumbUrl ?? item.posterUrl} alt="" loading="lazy" />
                    ) : (
                      <span>{t.icon}</span>
                    )}
                  </div>
                  <div className="title-cell">
                    <strong>{item.title}</strong>
                    <span className="muted small">
                      {[item.year, item.genres.join(', ')].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                  <span className="badge" style={{ color: t.tint, borderColor: t.tint }}>
                    {t.icon} {t.label}
                  </span>
                  <span>
                    {item.episodes ? `${item.episodes}${item.seasons ? ` (${item.seasons} temp.)` : ''}` : '—'}
                  </span>
                  <span className="rating">★ {item.rating.toFixed(1)}</span>
                  <label className="switch" title={item.available ? 'Disponible' : 'No disponible'}>
                    <input type="checkbox" checked={item.available} onChange={() => toggleAvailable(item)} />
                    <span />
                  </label>
                  <div className="actions">
                    <button className="btn ghost small" onClick={() => setEditing(item)}>
                      Editar
                    </button>
                    <button className="btn danger small" onClick={() => remove(item)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            })}
            {visible.length > shown && (
              <div className="more">
                <span className="muted small">
                  Mostrando {shown} de {visible.length}
                </span>
                <button className="btn ghost small" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                  Mostrar más
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {editing && (
        <MediaForm
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onError={handleError}
        />
      )}

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.text}</div>}
    </div>
  )
}
