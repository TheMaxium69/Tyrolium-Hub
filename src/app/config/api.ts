import { isDevMode } from '@angular/core';

/** URL de base de tyrolium-api (Symfony). */
export const API_URL = isDevMode()
  ? 'http://127.0.0.1:8000'
  : 'https://api.tyrolium.fr';

/** Enveloppe unifiée de toutes les réponses de tyrolium-api (voir .doc/api-response-format.md côté API). */
export interface IApiResponse<T = unknown> {
  success: boolean;
  code:    number;
  message: string;
  data:    T | null;
  errors?: { field: string; message: string; rule?: string }[] | null;
  meta?:   { pagination?: IApiPagination } | null;
}

/** meta.pagination des routes de liste (?page=1&limit=20, limit max 100). */
export interface IApiPagination {
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

/** Les chemins d'image de l'API (ex. pp "/uploads/avatars/x.png") sont relatifs à API_URL. */
export function apiAsset(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}
