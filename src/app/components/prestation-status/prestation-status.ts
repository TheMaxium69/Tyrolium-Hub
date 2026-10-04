import { Component, computed, inject, input } from '@angular/core';
import { TyroUiChip, TyroUiChipVariant, TyroUiLangService } from 'tyrolium-ui';
import { PrestationStatus } from '../../services/prestation.service';

const STATUS: Record<PrestationStatus, { fr: string; en: string; icon: string; variant: TyroUiChipVariant }> = {
  pending:    { fr: 'En attente', en: 'Pending',    icon: 'ri-time-line',             variant: 'warning' },
  active:     { fr: 'Active',     en: 'Active',     icon: 'ri-play-circle-line',      variant: 'success' },
  suspended:  { fr: 'Suspendue',  en: 'Suspended',  icon: 'ri-pause-circle-line',     variant: 'danger'  },
  terminated: { fr: 'Terminée',   en: 'Terminated', icon: 'ri-checkbox-circle-line',  variant: 'default' },
};

/** Libellé traduit d'un statut (sert aussi aux listes déroulantes). */
export function prestationStatusLabel(status: PrestationStatus, lang: string): string {
  return lang === 'en' ? STATUS[status].en : STATUS[status].fr;
}

export function prestationStatusIcon(status: PrestationStatus): string {
  return STATUS[status].icon;
}

@Component({
  selector: 'app-prestation-status',
  imports: [TyroUiChip],
  template: `<tyro-ui-chip [variant]="meta().variant" size="sm" [icon]="meta().icon">{{ label() }}</tyro-ui-chip>`,
})
export class PrestationStatusChip {
  readonly lang   = inject(TyroUiLangService).lang;
  readonly status = input<PrestationStatus>('pending');

  readonly meta  = computed(() => STATUS[this.status()]);
  readonly label = computed(() => prestationStatusLabel(this.status(), this.lang()));
}
