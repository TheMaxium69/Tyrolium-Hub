import { inject, Injectable } from '@angular/core';
import { API_URL, IApiResponse } from '../config/api';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';

/** Projet suivi (un par site). */
export interface IAnalyticsProject {
  id:          number;
  /** Identifiant à mettre dans le snippet du site, ex. "TyroTag-7091d95e…". */
  tag:         string;
  domainNames: string[];
  description: string | null;
  createdBy:   IHubUser | null;
  createdAt:   string;
}

/** Une visite = un chargement de page. */
export interface IAnalyticsInput {
  id:        number;
  project:   IAnalyticsProject;
  ip:        string;
  pageName:  string;
  uri:       string;
  isLogin:   boolean;
  createdAt: string;
}

export interface IAnalyticsSearch {
  projectTag?: string;
  ip?:         string;
  pageName?:   string;
  uri?:        string;
}

/** Période des statistiques : bornes incluses, AAAA-MM-JJ ; absentes = toute la période. */
export interface IAnalyticsRange {
  from?: string;
  to?:   string;
}

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

export interface IAnalyticsTopPage {
  pageName:       string;
  uri:            string;
  visits:         number;
  uniqueVisitors: number;
}

export interface IAnalyticsDay {
  /** AAAA-MM-JJ */
  day:            string;
  visits:         number;
  uniqueVisitors: number;
}

/** Totaux calculés en base (get-stats-global / get-stats-project). */
export interface IAnalyticsStats {
  summary:      { visits: number; uniqueVisitors: number; loggedInVisits: number };
  topPages:     IAnalyticsTopPage[];
  /** Trié par jour croissant. */
  visitsPerDay: IAnalyticsDay[];
  /** Uniquement sur get-stats-global, trié par visites décroissantes. */
  projects:     { id: number; tag: string; visits: number; uniqueVisitors: number }[];
}

/** Taille d'une page de visites (max API). */
export const ANALYTICS_PAGE_SIZE = 100;

/** Module Analytics de tyrolium-api (routes /tyrolium/analytics/*). */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly auth = inject(HubAuthService);

  /* ─── Permissions ─────────────────────────────────────── */

  static readonly VIEW_ROLE = 'PERMS_TYROLIUM_ANALYTICS_VIEW';

  canCreate() { return this.auth.can(AnalyticsService.VIEW_ROLE, 'create'); }
  canUpdate() { return this.auth.can(AnalyticsService.VIEW_ROLE, 'update'); }
  canDelete() { return this.auth.can(AnalyticsService.VIEW_ROLE, 'delete'); }

  /* ─── Projets ─────────────────────────────────────────── */

  getAllProjects() {
    return this.auth.requestAll<IAnalyticsProject>('/tyrolium/analytics/get-all-project');
  }

  getProject(id: number) {
    return this.auth.request<IAnalyticsProject>(`/tyrolium/analytics/get-one-project/${id}`);
  }

  createProject(domainNames: string[], description: string | null) {
    return this.auth.request<IAnalyticsProject>('/tyrolium/analytics/post-create-project', {
      method: 'POST',
      body:   JSON.stringify({ domainNames, description }),
    });
  }

  addDomain(id: number, domainName: string) {
    return this.auth.request<IAnalyticsProject>(`/tyrolium/analytics/put-update-project-domain/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ domainName }),
    });
  }

  /** `null` efface la description (une chaîne vide est refusée par l'API). */
  updateDescription(id: number, description: string | null) {
    return this.auth.request<IAnalyticsProject>(`/tyrolium/analytics/put-update-project-description/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ description }),
    });
  }

  /** Supprime aussi toutes les visites du projet. */
  deleteProject(id: number) {
    return this.auth.request<null>(`/tyrolium/analytics/delete-project/${id}`, { method: 'DELETE' });
  }

  /* ─── Visites ─────────────────────────────────────────── */

  /** Une page de visites, les plus récentes d'abord (meta.pagination pour la suite). */
  getInputsPage(page: number) {
    return this.auth.request<IAnalyticsInput[]>(`/tyrolium/analytics/get-all-input?page=${page}&limit=${ANALYTICS_PAGE_SIZE}`);
  }

  getProjectInputsPage(id: number, page: number) {
    return this.auth.request<IAnalyticsInput[]>(`/tyrolium/analytics/get-input-by-project/${id}?page=${page}&limit=${ANALYTICS_PAGE_SIZE}`);
  }

  /* ─── Statistiques (calculées en base) ────────────────── */

  getStatsGlobal(range: IAnalyticsRange) {
    return this.auth.request<IAnalyticsStats>(`/tyrolium/analytics/get-stats-global${this.query(range)}`);
  }

  getStatsProject(id: number, range: IAnalyticsRange) {
    return this.auth.request<IAnalyticsStats>(`/tyrolium/analytics/get-stats-project/${id}${this.query(range)}`);
  }

  /** Période prédéfinie → bornes (jour local, aujourd'hui inclus). */
  range(period: AnalyticsPeriod): IAnalyticsRange {
    if (period === 'all') return {};
    const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
    const to   = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - (days - 1));
    return { from: this.isoDay(from), to: this.isoDay(to) };
  }

  searchInputs(search: IAnalyticsSearch) {
    const params = new URLSearchParams(
      Object.entries(search).filter(([, v]) => !!v) as [string, string][],
    );
    return this.auth.requestAll<IAnalyticsInput>(`/tyrolium/analytics/get-search-input?${params}`);
  }

  /* ─── Helpers ─────────────────────────────────────────── */

  /** Snippet à coller dans le <head> du site suivi. */
  snippet(project: IAnalyticsProject): string {
    return `<script src="${API_URL}/analytics.js" data-tyro-tag="${project.tag}" data-tyro-logged-in="false"></script>`;
  }

  private query(range: IAnalyticsRange): string {
    const params = new URLSearchParams(
      Object.entries(range).filter(([, v]) => !!v) as [string, string][],
    ).toString();
    return params ? `?${params}` : '';
  }

  private isoDay(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
