import { inject, Injectable } from '@angular/core';
import { HubAuthService } from './hub-auth.service';

/** Carte publique d'un compte (GET /useritium/dashboard/get-user-card/{id}) : jamais d'email ni de permission. */
export interface IUserCard {
  username:    string;
  displayName: string | null;
  pp:          string | null;
  type:        'public' | 'interne';
  status:      'actif' | 'banni';
}

/** Cartes utilisateur pour les bulles "Détail" des chips, mises en cache le temps de la session. */
@Injectable({ providedIn: 'root' })
export class UserCardService {
  private readonly auth  = inject(HubAuthService);
  private readonly cache = new Map<number, Promise<IUserCard | null>>();

  get(id: number): Promise<IUserCard | null> {
    let card = this.cache.get(id);
    if (!card) {
      card = this.auth.request<IUserCard>(`/useritium/dashboard/get-user-card/${id}`)
        .then(res => res.success ? res.data : null)
        .catch(() => null);
      // Échec : on ne garde pas en cache, pour pouvoir réessayer.
      card.then(c => { if (!c) this.cache.delete(id); });
      this.cache.set(id, card);
    }
    return card;
  }

  /** À appeler après une modification du compte (pseudo, nom affiché, suspension…). */
  invalidate(id: number) {
    this.cache.delete(id);
  }
}
