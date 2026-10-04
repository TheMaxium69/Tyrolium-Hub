import { inject, Injectable } from '@angular/core';
import { hubUserName, IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';

export type OffreVisibility    = 'listed' | 'custom';
export type PrestationStatus   = 'pending' | 'active' | 'suspended' | 'terminated';

/** Offre du catalogue. Prix en centimes. */
export interface IOffre {
  id:          number;
  tagName:     string;
  displayName: string;
  description: string | null;
  visibility:  OffreVisibility;
  price:       number | null;
  isActive:    boolean;
  createdAt:   string;
}

export interface IOffrePayload {
  tagName?:     string;
  displayName?: string;
  description?: string | null;
  visibility?:  OffreVisibility;
  price?:       number | null;
  isActive?:    boolean;
}

/** Offre vendue à un client : soit un compte Useritium (user), soit clientName (clientEmail facultatif). */
export interface IPrestation {
  id:          number;
  offre:       IOffre;
  user:        IHubUser | null;
  clientName:  string | null;
  clientEmail: string | null;
  status:      PrestationStatus;
  content:     string | null;
  /** 0 à 100. */
  progress:    number;
  /** Prix réellement appliqué, en centimes. */
  price:       number | null;
  startedAt:   string | null;
  endedAt:     string | null;
  createdAt:   string;
  createdBy:   IHubUser | null;
}

export interface IPrestationPayload {
  offreId?:     number;
  /** null : détache le compte (clientName devient obligatoire, clientEmail reste facultatif). */
  userId?:      number | null;
  clientName?:  string | null;
  clientEmail?: string | null;
  content?:     string | null;
  progress?:    number;
  price?:       number | null;
  status?:      PrestationStatus;
}

export const PRESTATION_STATUSES: PrestationStatus[] = ['pending', 'active', 'suspended', 'terminated'];

/** Offres + prestations de tyrolium-api (routes /tyrolium/prestation/*). */
@Injectable({ providedIn: 'root' })
export class PrestationService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/tyrolium/prestation';

  static readonly OFFRE_VIEW      = 'PERMS_TYROLIUM_OFFRE_VIEW';
  static readonly PRESTATION_VIEW = 'PERMS_TYROLIUM_PRESTATION_VIEW';

  canOffre(action: 'create' | 'update' | 'delete')      { return this.auth.can(PrestationService.OFFRE_VIEW, action); }
  canPrestation(action: 'create' | 'update' | 'delete') { return this.auth.can(PrestationService.PRESTATION_VIEW, action); }
  /** Choisir un compte Useritium comme client nécessite de pouvoir lister les comptes. */
  canPickUser() { return this.auth.hasRole('PERMS_USERITIUM_USER_VIEW'); }

  /* ─── Offres ──────────────────────────────────────────── */

  getAllOffres() { return this.auth.requestAll<IOffre>(`${this.base}/get-all-offre`); }

  getOffre(id: number) { return this.auth.request<IOffre>(`${this.base}/get-one-offre/${id}`); }

  createOffre(payload: IOffrePayload) {
    return this.auth.request<IOffre>(`${this.base}/post-create-offre`, { method: 'POST', body: JSON.stringify(payload) });
  }

  updateOffre(id: number, payload: IOffrePayload) {
    return this.auth.request<IOffre>(`${this.base}/put-update-offre/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  /** 409 si des prestations y sont liées : la désactiver à la place. */
  deleteOffre(id: number) {
    return this.auth.request<null>(`${this.base}/delete-offre/${id}`, { method: 'DELETE' });
  }

  /* ─── Prestations ─────────────────────────────────────── */

  getAllPrestations() { return this.auth.requestAll<IPrestation>(`${this.base}/get-all-prestation`); }

  getPrestation(id: number) { return this.auth.request<IPrestation>(`${this.base}/get-one-prestation/${id}`); }

  createPrestation(payload: IPrestationPayload) {
    return this.auth.request<IPrestation>(`${this.base}/post-create-prestation`, { method: 'POST', body: JSON.stringify(payload) });
  }

  updatePrestation(id: number, payload: IPrestationPayload) {
    return this.auth.request<IPrestation>(`${this.base}/put-update-prestation/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  deletePrestation(id: number) {
    return this.auth.request<null>(`${this.base}/delete-prestation/${id}`, { method: 'DELETE' });
  }

  /** Nom affichable du client (compte ou client sans compte). */
  clientLabel(p: IPrestation) {
    return p.user ? hubUserName(p.user) : p.clientName ?? '-';
  }
}
