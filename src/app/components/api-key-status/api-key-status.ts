import { Component, computed, inject, input } from '@angular/core';
import { TyroUiChip, TyroUiLangService } from 'tyrolium-ui';
import { ApiKeyEnvironment, ApiKeyStatus } from '../../services/api-key.service';

/** Chips "environnement" (live / test) + statut (active / expirée / révoquée) d'une clé API. */
@Component({
  selector: 'app-api-key-status',
  imports: [TyroUiChip],
  template: `
    <span class="aks">
      @if (environment()) {
        @if (environment() === 'live') {
          <tyro-ui-chip size="sm" variant="accent" icon="ri-flashlight-line">Live</tyro-ui-chip>
        } @else {
          <tyro-ui-chip size="sm" icon="ri-flask-line">Test</tyro-ui-chip>
        }
      }
      @if (status()) {
        <tyro-ui-chip size="sm" [variant]="meta().variant" [icon]="meta().icon">{{ meta().label }}</tyro-ui-chip>
      }
    </span>
  `,
  styles: `.aks { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; }`,
})
export class ApiKeyStatusChip {
  readonly lang        = inject(TyroUiLangService).lang;
  readonly environment = input<ApiKeyEnvironment | null>(null);
  readonly status      = input<ApiKeyStatus | null>(null);

  readonly meta = computed(() => {
    const en = this.lang() === 'en';
    switch (this.status()) {
      case 'revoked': return { variant: 'danger'  as const, icon: 'ri-forbid-line',          label: en ? 'Revoked' : 'Révoquée' };
      case 'expired': return { variant: 'warning' as const, icon: 'ri-time-line',            label: en ? 'Expired' : 'Expirée' };
      default:        return { variant: 'success' as const, icon: 'ri-checkbox-circle-line', label: en ? 'Active'  : 'Active' };
    }
  });
}
