import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiDataTable,
  TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader, TyroUiSkeleton, TyroUiSnackbarService,
  TyroUiTextField,
} from 'tyrolium-ui';
import { AnalyticsDaily } from '../../../components/analytics-daily/analytics-daily';
import { AnalyticsPeriodPicker } from '../../../components/analytics-period/analytics-period';
import { AnalyticsStats } from '../../../components/analytics-stats/analytics-stats';
import { AnalyticsTopPages } from '../../../components/analytics-top-pages/analytics-top-pages';
import { AnalyticsVisits } from '../../../components/analytics-visits/analytics-visits';
import { HubUser } from '../../../components/hub-user/hub-user';
import { IApiResponse } from '../../../config/api';
import {
  AnalyticsPeriod, AnalyticsService, IAnalyticsInput, IAnalyticsProject, IAnalyticsStats,
} from '../../../services/analytics.service';
import { formatDate } from '../../../utils/format';

@Component({
  selector: 'app-analytics-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiChip,
    TyroUiTextField, TyroUiAlert, TyroUiSkeleton, AnalyticsStats, AnalyticsVisits, AnalyticsTopPages,
    AnalyticsDaily, AnalyticsPeriodPicker, HubUser,
  ],
  templateUrl: './analytics-list.html',
  styleUrl: './analytics-list.css',
})
export class AnalyticsList implements OnInit {
  readonly lang      = inject(TyroUiLangService).lang;
  readonly analytics = inject(AnalyticsService);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly projects  = signal<IAnalyticsProject[]>([]);

  /* ─── Statistiques (calculées en base, selon la période) ─ */
  readonly period       = signal<AnalyticsPeriod>('30d');
  readonly range        = computed(() => this.analytics.range(this.period()));
  readonly stats        = signal<IAnalyticsStats | null>(null);
  readonly statsLoading = signal(true);
  readonly statsError   = signal(false);

  /* ─── Dernières visites (paginées, chargées à la demande) ─ */
  readonly inputs        = signal<IAnalyticsInput[]>([]);
  readonly inputsTotal   = signal(0);
  readonly inputsLoading = signal(false);
  readonly inputsError   = signal(false);
  private inputsPage = 0;
  private inputsPages = 1;
  readonly hasMoreInputs = signal(false);

  /* ─── Création ───────────────────────────────────────── */
  readonly createOpen  = signal(false);
  readonly creating    = signal(false);
  readonly createError = signal<string | null>(null);
  newDomains     = '';
  newDescription = '';

  readonly projectCols: ITyroUiDataTableColumn[] = [
    { key: 'domains',     label: 'Domaines',    labelEn: 'Domains', sortable: true },
    { key: 'tag',         label: 'Tag',                             width: '260px' },
    { key: 'description', label: 'Description' },
    { key: 'visits',      label: 'Visites (période)', labelEn: 'Visits (period)', sortable: true, width: '140px', align: 'right' },
    { key: 'createdAt',   label: 'Créé le',     labelEn: 'Created', sortable: true, width: '160px' },
    { key: 'createdBy',   label: 'Créé par',    labelEn: 'Created by', sortable: true, width: '170px' },
    { key: 'actions',     label: '',                                width: '110px', align: 'right' },
  ];

  readonly projectRows = computed(() => {
    const visits = new Map((this.stats()?.projects ?? []).map(p => [p.id, p.visits]));
    return this.projects().map(p => ({
      id:          p.id,
      domains:     p.domainNames.join(', '),
      domainNames: p.domainNames,
      tag:         p.tag,
      description: p.description ?? '',
      // Zéro-paddé pour que le tri (comparaison de chaînes du data-table) reste numérique.
      visits:      String(visits.get(p.id) ?? 0).padStart(9, '0'),
      createdAt:   p.createdAt,
      createdBy:   p.createdBy?.username ?? '',
      author:      p.createdBy,
    }));
  });

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.inputs.set([]);
    this.inputsPage = 0;
    try {
      const [projects] = await Promise.all([
        this.analytics.getAllProjects(),
        this.loadStats(),
        this.loadMoreInputs(),
      ]);
      if (!projects.success) throw new Error();
      this.projects.set(projects.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  setPeriod(period: AnalyticsPeriod) {
    if (period === this.period()) return;
    this.period.set(period);
    this.loadStats();
  }

  async loadStats() {
    this.statsLoading.set(true);
    this.statsError.set(false);
    try {
      const res = await this.analytics.getStatsGlobal(this.range());
      if (!res.success || !res.data) throw new Error();
      this.stats.set(res.data);
    } catch {
      this.stats.set(null);
      this.statsError.set(true);
    } finally {
      this.statsLoading.set(false);
    }
  }

  /** Page suivante des visites (100 par 100, les plus récentes d'abord). */
  async loadMoreInputs() {
    if (this.inputsLoading()) return;
    this.inputsLoading.set(true);
    this.inputsError.set(false);
    try {
      const res = await this.analytics.getInputsPage(this.inputsPage + 1);
      if (!res.success) throw new Error();
      this.inputsPage++;
      this.inputsPages = res.meta?.pagination?.pages ?? 1;
      this.inputsTotal.set(res.meta?.pagination?.total ?? 0);
      this.inputs.update(list => [...list, ...(res.data ?? [])]);
      this.hasMoreInputs.set(this.inputsPage < this.inputsPages);
    } catch {
      this.inputsError.set(true);
    } finally {
      this.inputsLoading.set(false);
    }
  }

  open(id: number) {
    this.router.navigate(['/analytics', id]);
  }

  toggleCreate() {
    this.createOpen.update(v => !v);
    this.createError.set(null);
  }

  async create(e?: Event) {
    e?.preventDefault();
    const domains = this.newDomains.split(/[\s,;]+/).map(d => d.trim().toLowerCase()).filter(Boolean);
    if (!domains.length || this.creating()) {
      this.createError.set(this.lang() === 'en' ? 'Enter at least one domain name.' : 'Saisissez au moins un nom de domaine.');
      return;
    }

    this.creating.set(true);
    this.createError.set(null);
    try {
      const res = await this.analytics.createProject(domains, this.newDescription.trim() || null);
      if (!res.success || !res.data) {
        this.createError.set(this.errorMessage(res));
        return;
      }
      this.snackbar.show({
        type: 'success',
        message: this.lang() === 'en' ? 'Project created, install the snippet on the site.' : 'Projet créé, installez le snippet sur le site.',
      });
      this.router.navigate(['/analytics', res.data.id]);
    } catch {
      this.createError.set(this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.creating.set(false);
    }
  }

  visits(padded: string) { return Number(padded); }
  date(iso: string) { return formatDate(iso, this.lang()); }

  /** 403 : action masquée (droits relus par HubAuthService), pas d'erreur technique. */
  private errorMessage(res: IApiResponse<unknown>): string | null {
    if (res.code === 403) {
      this.createOpen.set(false);
      return null;
    }
    return res.errors?.[0]?.message ?? res.message;
  }
}
