import { Component, computed, inject, input } from '@angular/core';
import { ITyroUiUserChipBadge, ITyroUiUserChipLine, TyroUiLangService, TyroUiUserChip } from 'tyrolium-ui';
import { IPrestation } from '../../services/prestation.service';
import { HubUser } from '../hub-user/hub-user';

/** Client d'une prestation en chip cliquable : compte Useritium, ou client sans compte (nom + email). */
@Component({
  selector: 'app-prestation-client',
  imports: [HubUser, TyroUiUserChip],
  template: `
    @if (prestation(); as p) {
      @if (p.user) {
        <app-hub-user [user]="p.user"></app-hub-user>
      } @else {
        <tyro-ui-user-chip [name]="p.clientName ?? '-'" [lines]="guestLines()" [badges]="guestBadges()"></tyro-ui-user-chip>
      }
    }
  `,
})
export class PrestationClient {
  readonly lang       = inject(TyroUiLangService).lang;
  readonly prestation = input<IPrestation | null>(null);

  readonly guestLines = computed<ITyroUiUserChipLine[]>(() => {
    const email = this.prestation()?.clientEmail;
    return email ? [{ text: email, icon: 'ri-mail-line' }] : [];
  });

  readonly guestBadges = computed<ITyroUiUserChipBadge[]>(() => [
    { label: this.lang() === 'en' ? 'No account' : 'Sans compte', icon: 'ri-user-unfollow-line' },
  ]);
}
