import { useCallback, useEffect, useState } from 'react'
import { api, typeInfo, type TitleRequest } from '../api'

interface Props {
  onClose: () => void
  onError: (e: unknown) => void
  /** Abre el formulario de "Nuevo título" para atender el pedido. */
  onAdd: () => void
}

const STATUS_LABEL = { pendiente: 'Pendiente', agregado: 'Agregado', descartado: 'Descartado' } as const

/** Pedidos de títulos que hacen los usuarios desde la app. */
export function Requests({ onClose, onError, onAdd }: Props) {
  const [items, setItems] = useState<TitleRequest[] | null>(null)
  const [filter, setFilter] = useState<'pendiente' | 'todos'>('pendiente')

  const load = useCallback(async () => {
    try {
      setItems(await api.requests())
    } catch (e) {
      onError(e)
    }
  }, [onError])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (r: TitleRequest, status: TitleRequest['status']) => {
    try {
      const updated = await api.setRequestStatus(r.id, status)
      setItems((list) => list?.map((x) => (x.id === r.id ? updated : x)) ?? null)
    } catch (e) {
      onError(e)
    }
  }

  const remove = async (r: TitleRequest) => {
    if (!confirm(`¿Eliminar el pedido «${r.title}»?`)) return
    try {
      await api.removeRequest(r.id)
      setItems((list) => list?.filter((x) => x.id !== r.id) ?? null)
    } catch (e) {
      onError(e)
    }
  }

  const visible = (items ?? []).filter((r) => filter === 'todos' || r.status === 'pendiente')

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card">
        <div className="modal-head">
          <h2>📨 Pedidos de títulos</h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="mode-switch" role="tablist">
          <button type="button" role="tab" aria-selected={filter === 'pendiente'} onClick={() => setFilter('pendiente')}>
            Pendientes ({(items ?? []).filter((r) => r.status === 'pendiente').length})
          </button>
          <button type="button" role="tab" aria-selected={filter === 'todos'} onClick={() => setFilter('todos')}>
            Todos ({items?.length ?? 0})
          </button>
        </div>

        {items === null ? (
          <p className="muted">Cargando…</p>
        ) : visible.length === 0 ? (
          <p className="muted">No hay pedidos {filter === 'pendiente' ? 'pendientes' : ''}.</p>
        ) : (
          <div className="requests">
            {visible.map((r) => (
              <div key={r.id} className="request">
                <div className="request-main">
                  <strong>{r.title}</strong>
                  {r.type && <span className="muted small"> · {typeInfo(r.type).label}</span>}
                  <div className="muted small">
                    {r.requester ? `${r.requester} · ` : ''}
                    {new Date(r.createdAt).toLocaleString('es-CO')} · {STATUS_LABEL[r.status]}
                  </div>
                  {r.note && <div className="small">“{r.note}”</div>}
                </div>
                <div className="request-actions">
                  <button className="btn ghost small" onClick={onAdd} title="Abre el formulario para agregarlo">
                    + Agregar
                  </button>
                  {r.status !== 'agregado' && (
                    <button className="btn primary small" onClick={() => setStatus(r, 'agregado')}>
                      ✔ Listo
                    </button>
                  )}
                  {r.status === 'pendiente' && (
                    <button className="btn ghost small" onClick={() => setStatus(r, 'descartado')}>
                      Descartar
                    </button>
                  )}
                  <button className="btn danger small" onClick={() => remove(r)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
