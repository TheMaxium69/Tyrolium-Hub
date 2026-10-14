import { Component, computed, inject, input } from '@angular/core';
import { TyroUiChip, TyroUiChipVariant, TyroUiLangService } from 'tyrolium-ui';
import { ServerStatus } from '../../services/solidserv-server.service';

const STATUS: Record<ServerStatus, { fr: string; en: string; icon: string; variant: TyroUiChipVariant }> = {
  provisioning:   { fr: 'En création',     en: 'Provisioning',   icon: 'ri-loader-4-line',        variant: 'accent'  },
  active:         { fr: 'Actif',           en: 'Active',         icon: 'ri-checkbox-circle-line', variant: 'success' },
  maintenance:    { fr: 'Maintenance',     en: 'Maintenance',    icon: 'ri-tools-line',           variant: 'warning' },
  suspended:      { fr: 'Suspendu',        en: 'Suspended',      icon: 'ri-pause-circle-line',    variant: 'danger'  },
  decommissioned: { fr: 'Décommissionné',  en: 'Decommissioned', icon: 'ri-archive-line',         variant: 'default' },
};

export function serverStatusLabel(status: ServerStatus, lang: string) {
  return lang === 'en' ? STATUS[status].en : STATUS[status].fr;
}
export function serverStatusIcon(status: ServerStatus) {
  return STATUS[status].icon;
}

/** Statut d'un serveur SolidServ. */
@Component({
  selector: 'app-server-status',
  imports: [TyroUiChip],
  template: `<tyro-ui-chip size="sm" [variant]="meta().variant" [icon]="meta().icon">{{ label() }}</tyro-ui-chip>`,
})
export class ServerStatusChip {
  readonly lang   = inject(TyroUiLangService).lang;
  readonly status = input<ServerStatus>('active');
  readonly meta   = computed(() => STATUS[this.status()]);
  readonly label  = computed(() => serverStatusLabel(this.status(), this.lang()));
}
