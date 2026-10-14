import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiButtonGroupItem, ITyroUiDataTableColumn, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton,
  TyroUiButtonGroup, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader, TyroUiSelect,
  TyroUiSkeleton,
} from 'tyrolium-ui';
import { ServerLink } from '../../../components/server-link/server-link';
import {
  DomainExpiry, WebSiteOwner, WebSiteStatusChip, webSiteStatusIcon, webSiteStatusLabel,
} from '../../../components/web-site-badges/web-site-badges';
import { IWebSite, WEB_SITE_STATUSES, WebSiteService } from '../../../services/web-site.service';

type OwnerFilter = 'all' | 'filiale' | 'client';

/** Registre des sites web et noms de domaine. */
@Component({
  selector: 'app-websites-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiButtonGroup,
    TyroUiSelect, TyroUiAlert, TyroUiSkeleton, WebSiteStatusChip, WebSiteOwner, DomainExpiry, ServerLink,
  ],
  templateUrl: './websites-list.html',
  styleUrl: './websites-list.css',
})
export class WebsitesList implements OnInit {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(WebSiteService);
  private readonly router = inject(Router);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly sites     = signal<IWebSite[]>([]);
  /** Domaines expirés ou à renouveler sous 30 jours (archivés exclus par l'API). */
  readonly expiring  = signal<IWebSite[]>([]);
  /** Certificats SSL expirés ou à renouveler sous 30 jours (archivés exclus par l'API). */
  readonly expiringSsl = signal<IWebSite[]>([]);

  readonly ownerFilter  = signal<OwnerFilter>('all');
  readonly statusFilter = signal('');

  readonly counts = computed(() => {
    const sites = this.sites();
    return {
      total:   sites.length,
      active:  sites.filter(s => s.status === 'active').length,
      filiale: sites.filter(s => s.ownerType === 'filiale').length,
      client:  sites.filter(s => s.ownerType === 'client').length,
    };
  });

  readonly ownerItems = computed<ITyroUiButtonGroupItem[]>(() => {
    const en = this.lang() === 'en';
    return [
      { value: 'all',     label: en ? 'All' : 'Tous' },
      { value: 'filiale', label: en ? 'Subsidiaries' : 'Filiales', icon: 'ri-building-line' },
      { value: 'client',  label: 'Clients', icon: 'ri-user-star-line' },
    ];
  });

  readonly statusItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'All statuses' : 'Tous les statuts' },
    ...WEB_SITE_STATUSES.map(s => ({ value: s, label: webSiteStatusLabel(s, this.lang()), icon: webSiteStatusIcon(s) })),
  ]);

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'domain',    label: 'Domaine',       labelEn: 'Domain',    sortable: true },
    { key: 'owner',     label: 'Propriétaire',  labelEn: 'Owner',     sortable: true },
    { key: 'status',    label: 'Statut',        labelEn: 'Status',    sortable: true, width: '140px' },
    { key: 'expiry',    label: 'Domaine',       labelEn: 'Domain',    sortable: true, width: '150px' },
    { key: 'ssl',       label: 'SSL',                                 sortable: true, width: '150px' },
    { key: 'server',    label: 'Serveur',       labelEn: 'Server',    sortable: true, width: '140px' },
    { key: 'actions',   label: '',                                    width: '150px', align: 'right' },
  ];

  readonly rows = computed(() => {
    const owner  = this.ownerFilter();
    const status = this.statusFilter();
    return this.sites()
      .filter(s => owner === 'all' || s.ownerType === owner)
      .filter(s => !status || s.status === status)
      .map(s => ({
        id:        s.id,
        // Domaine + nom + client : la recherche du tableau trouve les trois.
        domain:    `${s.domainName} ${s.name}`,
        owner:     s.ownerType === 'filiale'
          ? (this.service.filiale(s.filiale)?.label ?? s.filiale ?? '')
          : (s.user?.displayName || s.user?.username || s.clientName || s.prestation?.clientName || ''),
        status:    s.status,
        // Tri : décalé pour rester positif, sans échéance en dernier.
        expiry:    s.daysUntilExpiry === null ? 'zzzz' : String(s.daysUntilExpiry + 100000).padStart(7, '0'),
        ssl:       s.sslDaysUntilExpiry === null ? 'zzzz' : String(s.sslDaysUntilExpiry + 100000).padStart(7, '0'),
        server:    s.server?.name ?? 'zzzz',
        site:      s,
      }));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [sites, expiring, expiringSsl] = await Promise.all([
        this.service.getAll(),
        this.service.getExpiring(30),
        this.service.getExpiringSsl(30),
      ]);
      if (!sites.success) throw new Error();
      this.sites.set(sites.data ?? []);
      this.expiring.set(expiring.success ? expiring.data ?? [] : []);
      this.expiringSsl.set(expiringSsl.success ? expiringSsl.data ?? [] : []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number | 'nouveau') {
    this.router.navigate(['/websites', id]);
  }
}
