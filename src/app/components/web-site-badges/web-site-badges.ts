import { Component, computed, inject, input } from '@angular/core';
import { TyroUiChip, TyroUiChipVariant, TyroUiLangService } from 'tyrolium-ui';
import { IWebSite, WebSiteService, WebSiteStatus } from '../../services/web-site.service';
import { formatDate } from '../../utils/format';
import { HubUser } from '../hub-user/hub-user';

const STATUS: Record<WebSiteStatus, { fr: string; en: string; icon: string; variant: TyroUiChipVariant }> = {
  active:      { fr: 'Actif',       en: 'Active',      icon: 'ri-checkbox-circle-line', variant: 'success' },
  maintenance: { fr: 'Maintenance', en: 'Maintenance', icon: 'ri-tools-line',           variant: 'warning' },
  suspended:   { fr: 'Suspendu',    en: 'Suspended',   icon: 'ri-pause-circle-line',    variant: 'danger'  },
  archived:    { fr: 'Archivé',     en: 'Archived',    icon: 'ri-archive-line',         variant: 'default' },
};

export function webSiteStatusLabel(status: WebSiteStatus, lang: string) {
  return lang === 'en' ? STATUS[status].en : STATUS[status].fr;
}
export function webSiteStatusIcon(status: WebSiteStatus) {
  return STATUS[status].icon;
}

/** Statut d'un site (actif / maintenance / suspendu / archivé). */
@Component({
  selector: 'app-web-site-status',
  imports: [TyroUiChip],
  template: `<tyro-ui-chip size="sm" [variant]="meta().variant" [icon]="meta().icon">{{ label() }}</tyro-ui-chip>`,
})
export class WebSiteStatusChip {
  readonly lang   = inject(TyroUiLangService).lang;
  readonly status = input<WebSiteStatus>('active');
  readonly meta   = computed(() => STATUS[this.status()]);
  readonly label  = computed(() => webSiteStatusLabel(this.status(), this.lang()));
}

/**
 * Échéance du nom de domaine (kind="domain") ou du certificat SSL (kind="ssl") :
 * rouge si expiré, orange à 30 jours ou moins (jours restants calculés par l'API).
 */
@Component({
  selector: 'app-domain-expiry',
  imports: [TyroUiChip],
  template: `
    @if (site()) {
      @if (days() === null) {
        <span class="de-none">{{ lang() === 'en' ? 'No expiry date' : 'Pas d\\'échéance' }}</span>
      } @else {
        <span class="de">
          <tyro-ui-chip size="sm" [variant]="variant()" [icon]="icon()">{{ text() }}</tyro-ui-chip>
          @if (showDate()) { <span class="de-date">{{ date() }}</span> }
          @if (autoRenew()) { <i class="ri-loop-right-line de-auto" [title]="lang() === 'en' ? 'Auto-renew' : 'Renouvellement auto'"></i> }
        </span>
      }
    }
  `,
  styles: `
    .de { display: inline-flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .de-date { font-size: 0.75rem; color: var(--dash-text-2); }
    .de-none { font-size: 0.8rem; color: var(--dash-text-muted); }
    .de-auto { color: var(--dash-text-2); }
  `,
})
export class DomainExpiry {
  readonly lang     = inject(TyroUiLangService).lang;
  readonly site     = input<IWebSite | null>(null);
  readonly kind     = input<'domain' | 'ssl'>('domain');
  readonly showDate = input(true);

  readonly days = computed(() => {
    const s = this.site();
    if (!s) return null;
    return (this.kind() === 'ssl' ? s.sslDaysUntilExpiry : s.daysUntilExpiry) ?? null;
  });

  readonly autoRenew = computed(() => this.kind() === 'ssl' ? !!this.site()?.sslAutoRenew : !!this.site()?.autoRenew);

  readonly variant = computed<TyroUiChipVariant>(() => {
    const d = this.days();
    if (d === null) return 'default';
    if (d < 0) return 'danger';
    if (d <= 30) return 'warning';
    return 'default';
  });

  readonly icon = computed(() => (this.days() ?? 0) < 0
    ? 'ri-error-warning-line'
    : (this.kind() === 'ssl' ? 'ri-lock-line' : 'ri-calendar-line'));

  readonly text = computed(() => {
    const d  = this.days() ?? 0;
    const en = this.lang() === 'en';
    if (d < 0)   return en ? `Expired ${-d} d ago` : `Expiré depuis ${-d} j`;
    if (d === 0) return en ? 'Expires today' : 'Expire aujourd\'hui';
    return en ? `In ${d} d` : `Dans ${d} j`;
  });

  readonly date = computed(() => {
    const iso = this.kind() === 'ssl' ? this.site()?.sslExpiresAt : this.site()?.domainExpiresAt;
    return iso ? formatDate(`${iso}T00:00:00`, this.lang()) : '';
  });
}

/** Propriétaire d'un site : filiale (logo + nom), ou client (compte, prestation, nom). */
@Component({
  selector: 'app-web-site-owner',
  imports: [TyroUiChip, HubUser],
  template: `
    @if (site(); as s) {
      @if (s.ownerType === 'filiale') {
        <span class="wo-filiale">
          @if (filiale(); as f) { <img [src]="f.logo" [alt]="f.label" class="wo-logo"> }
          <strong>{{ filiale()?.label ?? s.filiale }}</strong>
        </span>
      } @else {
        <span class="wo-client">
          @if (s.user) {
            <app-hub-user [user]="s.user"></app-hub-user>
          } @else {
            <strong>{{ s.clientName || s.prestation?.clientName || '-' }}</strong>
          }
          @if (s.prestation && showPrestation()) {
            <tyro-ui-chip size="sm" icon="ri-briefcase-4-line">{{ s.prestation.offre.displayName }}</tyro-ui-chip>
          }
        </span>
      }
    }
  `,
  styles: `
    .wo-filiale, .wo-client { display: inline-flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .wo-logo { width: 22px; height: 22px; object-fit: contain; }
    strong { color: var(--dash-text); }
  `,
})
export class WebSiteOwner {
  private readonly service = inject(WebSiteService);
  readonly site           = input<IWebSite | null>(null);
  readonly showPrestation = input(true);
  readonly filiale        = computed(() => this.service.filiale(this.site()?.filiale ?? null));
}
