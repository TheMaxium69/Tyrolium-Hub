import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiConfirmService, TyroUiLangService,
  TyroUiPageHeader, TyroUiSkeleton, TyroUiSnackbarService, TyroUiTextField,
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
import { formatDateTime } from '../../../utils/format';

@Component({
  selector: 'app-analytics-project',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiTextField, TyroUiAlert, TyroUiSkeleton,
    AnalyticsStats, AnalyticsVisits, AnalyticsTopPages, AnalyticsDaily, AnalyticsPeriodPicker, HubUser,
  ],
  templateUrl: './analytics-project.html',
  styleUrl: './analytics-project.css',
})
export class AnalyticsProject {
  readonly lang      = inject(TyroUiLangService).lang;
  readonly analytics = inject(AnalyticsService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  private id = 0;

  readonly loading  = signal(true);
  readonly notFound = signal(false);
  readonly loadError = signal(false);
  readonly project  = signal<IAnalyticsProject | null>(null);

  readonly snippet  = computed(() => {
    const project = this.project();
    return project ? this.analytics.snippet(project) : '';
  });

  /* ─── Statistiques (calculées en base, selon la période) ─ */
  readonly period       = signal<AnalyticsPeriod>('30d');
  readonly range        = computed(() => this.analytics.range(this.period()));
  readonly stats        = signal<IAnalyticsStats | null>(null);
  readonly statsLoading = signal(true);
  readonly statsError   = signal(false);

  /* ─── Visites (paginées, chargées à la demande) ───────── */
  readonly inputs        = signal<IAnalyticsInput[]>([]);
  readonly inputsTotal   = signal(0);
  readonly inputsLoading = signal(false);
  readonly inputsError   = signal(false);
  readonly hasMoreInputs = signal(false);
  private inputsPage = 0;
  /** Date de la visite la plus récente (première de la première page). */
  readonly lastVisit = computed(() => this.inputs()[0]?.createdAt ?? null);

  /* ─── Ajout de domaine ───────────────────────────────── */
  newDomain = '';
  readonly addingDomain = signal(false);
  readonly domainError  = signal<string | null>(null);

  /* ─── Description ────────────────────────────────────── */
  readonly editingDesc = signal(false);
  readonly savingDesc  = signal(false);
  readonly descError   = signal<string | null>(null);
  newDescription = '';

  readonly deleting = signal(false);

  constructor() {
    // Angular réutilise le composant entre /analytics/1 et /analytics/2 : on suit le paramètre.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.id = Number(params.get('id'));
      this.load();
    });
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.notFound.set(false);
    this.project.set(null);
    this.stats.set(null);
    this.inputs.set([]);
    this.inputsTotal.set(0);
    this.inputsPage = 0;
    this.newDomain = '';
    this.domainError.set(null);
    this.editingDesc.set(false);
    this.descError.set(null);
    try {
      const project = await this.analytics.getProject(this.id);
      if (project.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!project.success || !project.data) throw new Error();
      this.project.set(project.data);
      await Promise.all([this.loadStats(), this.loadMoreInputs()]);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/analytics']);
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
      const res = await this.analytics.getStatsProject(this.id, this.range());
      if (!res.success || !res.data) throw new Error();
      this.stats.set(res.data);
    } catch {
      this.stats.set(null);
      this.statsError.set(true);
    } finally {
      this.statsLoading.set(false);
    }
  }

  /** Page suivante des visites du projet (100 par 100, les plus récentes d'abord). */
  async loadMoreInputs() {
    if (this.inputsLoading()) return;
    this.inputsLoading.set(true);
    this.inputsError.set(false);
    try {
      const res = await this.analytics.getProjectInputsPage(this.id, this.inputsPage + 1);
      if (!res.success) throw new Error();
      this.inputsPage++;
      this.inputsTotal.set(res.meta?.pagination?.total ?? 0);
      this.inputs.update(list => [...list, ...(res.data ?? [])]);
      this.hasMoreInputs.set(this.inputsPage < (res.meta?.pagination?.pages ?? 1));
    } catch {
      this.inputsError.set(true);
    } finally {
      this.inputsLoading.set(false);
    }
  }

  async copySnippet() {
    try {
      await navigator.clipboard.writeText(this.snippet());
      this.snackbar.show({ type: 'success', message: this.lang() === 'en' ? 'Snippet copied.' : 'Snippet copié.' });
    } catch {
      this.snackbar.show({ type: 'warning', message: this.lang() === 'en' ? 'Copy failed, select the code manually.' : 'Copie impossible, sélectionnez le code manuellement.' });
    }
  }

  async addDomain(e?: Event) {
    e?.preventDefault();
    const domain = this.newDomain.trim().toLowerCase();
    if (!domain || this.addingDomain()) return;

    this.addingDomain.set(true);
    this.domainError.set(null);
    try {
      const res = await this.analytics.addDomain(this.id, domain);
      if (!res.success || !res.data) {
        this.domainError.set(this.errorMessage(res));
        return;
      }
      this.project.set(res.data);
      this.newDomain = '';
      this.snackbar.show({ type: 'success', message: this.lang() === 'en' ? `${domain} added.` : `${domain} ajouté.` });
    } catch {
      this.domainError.set(this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.addingDomain.set(false);
    }
  }

  startEditDescription() {
    this.newDescription = this.project()?.description ?? '';
    this.descError.set(null);
    this.editingDesc.set(true);
  }

  cancelEditDescription() {
    this.editingDesc.set(false);
    this.descError.set(null);
  }

  /** Champ vidé → null (l'API refuse la chaîne vide). */
  async saveDescription(e?: Event) {
    e?.preventDefault();
    if (this.savingDesc()) return;

    this.savingDesc.set(true);
    this.descError.set(null);
    try {
      const res = await this.analytics.updateDescription(this.id, this.newDescription.trim() || null);
      if (!res.success || !res.data) {
        const message = this.errorMessage(res);
        if (message) this.descError.set(message);
        else this.editingDesc.set(false);
        return;
      }
      this.project.set(res.data);
      this.editingDesc.set(false);
      this.snackbar.show({ type: 'success', message: this.lang() === 'en' ? 'Description updated.' : 'Description mise à jour.' });
    } catch {
      this.descError.set(this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.savingDesc.set(false);
    }
  }

  async remove() {
    const project = this.project();
    if (!project || this.deleting()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? 'Delete this project?' : 'Supprimer ce projet ?',
      message:      en
        ? `${project.domainNames.join(', ')} and its ${this.inputsTotal()} visits will be permanently deleted.`
        : `${project.domainNames.join(', ')} et ses ${this.inputsTotal()} visites seront définitivement supprimés.`,
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    this.deleting.set(true);
    try {
      const res = await this.analytics.deleteProject(project.id);
      if (!res.success) {
        const message = this.errorMessage(res);
        if (message) this.snackbar.show({ type: 'danger', message });
        return;
      }
      this.snackbar.show({ type: 'success', message: en ? 'Project deleted.' : 'Projet supprimé.' });
      this.back();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    } finally {
      this.deleting.set(false);
    }
  }

  date(iso: string) { return formatDateTime(iso, this.lang()); }

  /** 403 : l'action disparaît (droits relus par HubAuthService), pas d'erreur technique. */
  private errorMessage(res: IApiResponse<unknown>): string | null {
    if (res.code === 403) return null;
    return res.errors?.[0]?.message ?? res.message;
  }
}
