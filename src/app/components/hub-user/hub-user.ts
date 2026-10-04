import { Component, computed, inject, input, signal } from '@angular/core';
import {
  ITyroUiUserChipBadge, TyroUiAvatarSize, TyroUiLangService, TyroUiUserChip,
} from 'tyrolium-ui';
import { apiAsset } from '../../config/api';
import { IUserCard, UserCardService } from '../../services/user-card.service';

/**
 * Utilisateur tel que renvoyé par tyrolium-api (createdBy, grantedBy, prestation.user, profils admin…).
 * `pp` : chemin relatif à API_URL, ou null. `id` : présent partout (groupe user:identifier).
 */
export interface IHubUser {
  id?:          number;
  username:     string;
  displayName?: string | null;
  pp?:          string | null;
}

/** Règle d'affichage du Hub : nom affiché si renseigné, sinon pseudo. */
export function hubUserName(user: IHubUser | null | undefined): string {
  return user?.displayName || user?.username || '-';
}

/**
 * Affichage standard d'un utilisateur dans le Hub : tyro-ui-user-chip (avatar + nom, bulle "Détail" au clic).
 * Quand l'id est connu, la bulle est complétée par la carte utilisateur de l'API (type, statut).
 */
@Component({
  selector: 'app-hub-user',
  imports: [TyroUiUserChip],
  template: `
    @if (user(); as u) {
      <tyro-ui-user-chip
        [name]="name()"
        [username]="u.username"
        [src]="src()"
        [size]="size()"
        [badges]="badges()"
        [detailLoading]="loading()"
        [detailError]="error()"
        (opened)="loadCard()">
      </tyro-ui-user-chip>
    } @else {
      <span class="hu-none">-</span>
    }
  `,
  styles: `.hu-none { color: var(--dash-text-muted); }`,
})
export class HubUser {
  readonly lang = inject(TyroUiLangService).lang;
  private readonly cards = inject(UserCardService);

  readonly user = input<IHubUser | null | undefined>(null);
  readonly size = input<TyroUiAvatarSize>('sm');

  readonly name = computed(() => hubUserName(this.user()));
  readonly src  = computed(() => apiAsset(this.user()?.pp));

  readonly card    = signal<IUserCard | null>(null);
  readonly loading = signal(false);
  readonly failed  = signal(false);

  readonly error = computed(() => this.failed()
    ? (this.lang() === 'en' ? 'Unable to load this account.' : 'Impossible de charger ce compte.')
    : null);

  readonly badges = computed<ITyroUiUserChipBadge[]>(() => {
    const card = this.card();
    const en   = this.lang() === 'en';
    if (!card) return [];
    return [
      card.type === 'interne'
        ? { label: en ? 'Internal' : 'Interne', variant: 'accent',  icon: 'ri-shield-user-line' }
        : { label: 'Public',                     variant: 'default', icon: 'ri-user-line' },
      card.status === 'banni'
        ? { label: en ? 'Banned' : 'Banni', variant: 'danger',  icon: 'ri-forbid-line' }
        : { label: en ? 'Active' : 'Actif', variant: 'success', icon: 'ri-checkbox-circle-line' },
    ];
  });

  /** Sans id, la bulle affiche seulement ce qu'on a déjà : nom, pseudo, photo. */
  async loadCard() {
    const id = this.user()?.id;
    if (id === undefined) return;
    this.loading.set(true);
    this.failed.set(false);
    const card = await this.cards.get(id);
    this.card.set(card);
    this.failed.set(!card);
    this.loading.set(false);
  }
}
