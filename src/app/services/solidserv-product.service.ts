import { inject, Injectable } from '@angular/core';
import { IHubUser } from '../components/hub-user/hub-user';
import { HubAuthService } from './hub-auth.service';

export type SolidServVisibility = 'listed' | 'custom';

/** Produit du catalogue SolidServ (l'équivalent d'une Offre). Prix en centimes. */
export interface ISolidServProduct {
  id:           number;
  tagName:      string;
  displayName:  string;
  description:  string | null;
  /** listed = public sur solidserv.fr ; custom = sur-mesure, dédié à un contrat. */
  visibility:   SolidServVisibility;
  priceMonthly: number | null;
  priceYearly:  number | null;
  cpuCores:     number | null;
  ramMb:        number | null;
  storageGb:    number | null;
  /** null = illimité, 0 = rupture, n = unités restantes. */
  stock:        number | null;
  /** Calculé par l'API : stock illimité ou > 0. */
  inStock:      boolean;
  /** Ordre d'affichage (plus petit = en premier). */
  position:     number;
  isActive:     boolean;
  offre:        { id: number; tagName: string; displayName: string } | null;
  createdBy:    IHubUser | null;
  createdAt:    string;
}

export interface ISolidServProductPayload {
  tagName:      string;
  displayName:  string;
  description:  string | null;
  visibility:   SolidServVisibility;
  priceMonthly: number | null;
  priceYearly:  number | null;
  cpuCores:     number | null;
  ramMb:        number | null;
  storageGb:    number | null;
  stock:        number | null;
  position:     number;
  isActive:     boolean;
  offreId:      number | null;
}

/** Catalogue des produits SolidServ (routes /solidserv/product/*). */
@Injectable({ providedIn: 'root' })
export class SolidServProductService {
  private readonly auth = inject(HubAuthService);
  private readonly base = '/solidserv/product';

  static readonly VIEW_ROLE = 'PERMS_SOLIDSERV_PRODUCT_VIEW';

  can(action: 'create' | 'update' | 'delete') { return this.auth.can(SolidServProductService.VIEW_ROLE, action); }
  canPickOffre() { return this.auth.hasRole('PERMS_TYROLIUM_OFFRE_VIEW'); }

  /** Triés par position puis id. */
  getAll() { return this.auth.requestAll<ISolidServProduct>(`${this.base}/get-all-product`); }

  create(payload: ISolidServProductPayload) {
    return this.auth.request<ISolidServProduct>(`${this.base}/post-create-product`, { method: 'POST', body: JSON.stringify(payload) });
  }

  /** Seules les clés envoyées changent. */
  update(id: number, payload: Partial<ISolidServProductPayload>) {
    return this.auth.request<ISolidServProduct>(`${this.base}/put-update-product/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  /** Bientôt refusé (409) si un serveur du Dashboard utilise le produit : proposer de le désactiver. */
  delete(id: number) {
    return this.auth.request<null>(`${this.base}/delete-product/${id}`, { method: 'DELETE' });
  }

  /** 2048 → "2 Go", 512 → "512 Mo". */
  formatRam(mb: number | null, lang: string): string {
    if (mb === null) return '-';
    const go = lang === 'en' ? 'GB' : 'Go';
    const mo = lang === 'en' ? 'MB' : 'Mo';
    return mb >= 1024 ? `${+(mb / 1024).toFixed(1)} ${go}` : `${mb} ${mo}`;
  }

  /** 2000 → "2 To", 80 → "80 Go". */
  formatStorage(gb: number | null, lang: string): string {
    if (gb === null) return '-';
    const go = lang === 'en' ? 'GB' : 'Go';
    const to = lang === 'en' ? 'TB' : 'To';
    return gb >= 1000 ? `${+(gb / 1000).toFixed(1)} ${to}` : `${gb} ${go}`;
  }
}
