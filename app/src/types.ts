export type MediaType = 'pelicula' | 'serie' | 'anime' | 'novela' | 'documental' | 'reality';

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  /** URL absoluta o ruta relativa al servidor (p. ej. "/uploads/poster.jpg"). */
  posterUrl?: string;
  /** Miniatura 300×450 para las listas (más liviana que el póster). */
  thumbUrl?: string;
  backdropUrl?: string;
  /** Valoración de 0 a 10. */
  rating: number;
  synopsis: string;
  year?: number;
  genres: string[];
  /** Total de capítulos (series, anime, novelas). */
  episodes?: number;
  seasons?: number;
  /** Si está disponible ahora mismo para el cliente. */
  available: boolean;
  /** Fecha ISO en que se agregó al catálogo. */
  addedAt: string;
}

export interface Catalog {
  updatedAt: string;
  items: MediaItem[];
}

export type ConnectionStatus = 'unconfigured' | 'loading' | 'online' | 'offline';
