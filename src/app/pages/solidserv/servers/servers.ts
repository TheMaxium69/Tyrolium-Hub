import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiBarChartItem, ITyroUiButtonGroupItem, ITyroUiDataTableColumn, ITyroUiSelectItem, TyroUiAlert, TyroUiBarChart,
  TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup, TyroUiChip, TyroUiDataTable, TyroUiDataTableColDef,
  TyroUiLangService, TyroUiPageHeader, TyroUiSelect, TyroUiSkeleton,
} from 'tyrolium-ui';
import { HubUser } from '../../../components/hub-user/hub-user';
import { ServerStatusChip, serverStatusIcon, serverStatusLabel } from '../../../components/server-status/server-status';
import {
  IServer, IServerStats, SERVER_STATUSES, SolidServServerService,
} from '../../../services/solidserv-server.service';

type ClientFilter = 'all' | 'client' | 'internal';

/** Dashboard SolidServ : le parc de serveurs (clients et internes). */
@Component({
  selector: 'app-solidserv-servers',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiButtonGroup,
    TyroUiSelect, TyroUiChip, TyroUiBarChart, TyroUiAlert, TyroUiSkeleton, HubUser, ServerStatusChip,
  ],
  templateUrl: './servers.html',
  styleUrl: './servers.css',
})
export class SolidServServers implements OnInit {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(SolidServServerService);
  private readonly router = inject(Router);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly servers   = signal<IServer[]>([]);
  readonly stats     = signal<IServerStats | null>(null);

  readonly clientFilter = signal<ClientFilter>('all');
  readonly typeFilter   = signal('');
  readonly statusFilter = signal('');

  readonly typeChart = computed<ITyroUiBarChartItem[]>(() =>
    (this.stats()?.byType ?? []).map(t => ({ label: t.name, value: t.servers })),
  );

  readonly projects = computed(() =>
    [...(this.stats()?.byProject ?? [])].sort((a, b) => b.servers - a.servers),
  );

  readonly clientItems = computed<ITyroUiButtonGroupItem[]>(() => {
    const en = this.lang() === 'en';
    return [
      { value: 'all',      label: en ? 'All' : 'Tous' },
      { value: 'client',   label: 'Clients',                     icon: 'ri-user-star-line' },
      { value: 'internal', label: en ? 'Internal' : 'Internes',  icon: 'ri-building-line' },
    ];
  });

  readonly typeItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'All types' : 'Tous les types' },
    ...(this.stats()?.byType ?? []).map(t => ({ value: String(t.id), label: `${t.name} (${t.abbreviation})`, icon: 'ri-stack-line' })),
  ]);

  readonly statusItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'All statuses' : 'Tous les statuts' },
    ...SERVER_STATUSES.map(s => ({ value: s, label: serverStatusLabel(s, this.lang()), icon: serverStatusIcon(s) })),
  ]);

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'name',    label: 'Serveur',  labelEn: 'Server',  sortable: true },
    { key: 'type',    label: 'Type',                         sortable: true, width: '150px' },
    { key: 'owner',   label: 'Client',                       sortable: true },
    { key: 'project', label: 'Projet',   labelEn: 'Project', sortable: true, width: '130px' },
    { key: 'status',  label: 'Statut',   labelEn: 'Status',  sortable: true, width: '160px' },
    { key: 'actions', label: '',                             width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => {
    const client = this.clientFilter();
    const type   = this.typeFilter();
    const status = this.statusFilter();
    return this.servers()
      .filter(s => client === 'all' || (client === 'client') === s.hasClient)
      .filter(s => !type || String(s.type.id) === type)
      .filter(s => !status || s.status === status)
      .map(s => ({
        id:      s.id,
        // Nom + alias + hostname + lieu : la recherche du tableau trouve tout.
        name:    [s.name, s.alias, s.hostname, s.location].filter(Boolean).join(' '),
        type:    s.type.name,
        owner:   s.hasClient ? (s.user?.displayName || s.user?.username || s.clientName || '') : '~interne',
        project: s.project ?? '',
        status:  s.status,
        server:  s,
      }));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [servers, stats] = await Promise.all([this.service.getServers(), this.service.getStats()]);
      if (!servers.success || !stats.success) throw new Error();
      this.servers.set(servers.data ?? []);
      this.stats.set(stats.data);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number | 'nouveau') {
    this.router.navigate(['/solidserv/dashboard', id]);
  }
}
