import type { MediaType } from './types';

export const colors = {
  bg: '#0B0D12',
  surface: '#151922',
  surfaceAlt: '#1E2330',
  border: '#2A3040',
  text: '#F2F4F8',
  textMuted: '#9AA3B5',
  accent: '#22D3A6',
  accentDim: 'rgba(34, 211, 166, 0.15)',
  star: '#FFC94A',
  danger: '#FF5C6C',
  dangerDim: 'rgba(255, 92, 108, 0.15)',
  warning: '#FFB020',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const sections: { type: MediaType; label: string; singular: string; icon: string; tint: string }[] = [
  { type: 'pelicula', label: 'Películas', singular: 'Película', icon: '🎬', tint: '#5B8CFF' },
  { type: 'serie', label: 'Series', singular: 'Serie', icon: '📺', tint: '#22D3A6' },
  { type: 'anime', label: 'Anime', singular: 'Anime', icon: '🌸', tint: '#FF7AB6' },
  { type: 'novela', label: 'Novelas', singular: 'Novela', icon: '💞', tint: '#FFB020' },
  { type: 'documental', label: 'Documentales', singular: 'Documental', icon: '🌍', tint: '#A78BFA' },
  { type: 'reality', label: 'Reality shows', singular: 'Reality show', icon: '🎤', tint: '#FF6B4A' },
];

export function sectionOf(type: MediaType) {
  return sections.find((s) => s.type === type) ?? sections[0];
}
