export type MediaType = 'pelicula' | 'serie' | 'anime' | 'novela' | 'documental' | 'reality'

export interface MediaItem {
  id: string
  title: string
  type: MediaType
  posterUrl?: string
  thumbUrl?: string
  backdropUrl?: string
  rating: number
  synopsis: string
  year?: number
  genres: string[]
  episodes?: number
  seasons?: number
  available: boolean
  tmdbRef?: string
  addedAt: string
  updatedAt: string
}

export const TYPES: { value: MediaType; label: string; icon: string; tint: string }[] = [
  { value: 'pelicula', label: 'Películas', icon: '🎬', tint: '#5B8CFF' },
  { value: 'serie', label: 'Series', icon: '📺', tint: '#22D3A6' },
  { value: 'anime', label: 'Anime', icon: '🌸', tint: '#FF7AB6' },
  { value: 'novela', label: 'Novelas', icon: '💞', tint: '#FFB020' },
  { value: 'documental', label: 'Documentales', icon: '🌍', tint: '#A78BFA' },
  { value: 'reality', label: 'Reality shows', icon: '🎤', tint: '#FF6B4A' },
]

export const typeInfo = (t: MediaType) => TYPES.find((x) => x.value === t) ?? TYPES[0]

export interface TmdbResult {
  kind: 'movie' | 'tv'
  id: number
  ref: string
  title: string
  originalTitle: string
  year?: number
  rating: number
  overview: string
  posterPreview: string | null
  suggestedType: MediaType
  existingId: string | null
}

export interface TmdbDetails {
  kind: 'movie' | 'tv'
  ref: string
  title: string
  originalTitle: string
  year?: number
  rating: number
  votes: number
  synopsis: string
  synopsisLanguage: string
  genres: string[]
  episodes?: number
  seasons?: number
  suggestedType: MediaType
  posterPath: string | null
  backdropPath: string | null
  posterPreview: string | null
  backdropPreview: string | null
  imdbUrl: string | null
}

export class UnauthorizedError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  if (res.status === 401) throw new UnauthorizedError('Sesión expirada')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  me: () => request<{ username: string }>('/api/auth/me'),
  login: (username: string, password: string) =>
    request<{ username: string }>('/api/auth/login', json('POST', { username, password })),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  list: () => request<MediaItem[]>('/api/admin/media'),
  create: (form: FormData) => request<MediaItem>('/api/admin/media', { method: 'POST', body: form }),
  update: (id: string, form: FormData) => request<MediaItem>(`/api/admin/media/${id}`, { method: 'PUT', body: form }),
  setAvailable: (id: string, available: boolean) =>
    request<MediaItem>(`/api/admin/media/${id}/availability`, json('PATCH', { available })),
  remove: (id: string) => request<void>(`/api/admin/media/${id}`, { method: 'DELETE' }),
  tmdbStatus: () => request<{ enabled: boolean; language: string }>('/api/admin/tmdb/status'),
  tmdbSearch: (q: string, year?: string, language?: string) => {
    const p = new URLSearchParams({ q })
    if (year) p.set('year', year)
    if (language) p.set('language', language)
    return request<TmdbResult[]>(`/api/admin/tmdb/search?${p}`)
  },
  tmdbDetails: (kind: string, id: number, language?: string) =>
    request<TmdbDetails>(`/api/admin/tmdb/${kind}/${id}${language ? `?language=${language}` : ''}`),
}
