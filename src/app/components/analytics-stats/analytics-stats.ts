import { Component, computed, inject, input } from '@angular/core';
import { TyroUiBentoCard, TyroUiLangService, TyroUiSkeleton } from 'tyrolium-ui';
import { IAnalyticsStats } from '../../services/analytics.service';

/** Rangée de chiffres clés (totaux calculés en base par l'API). */
@Component({
  selector: 'app-analytics-stats',
  imports: [TyroUiBentoCard, TyroUiSkeleton],
  templateUrl: './analytics-stats.html',
  styleUrl: './analytics-stats.css',
})
export class AnalyticsStats {
  readonly lang = inject(TyroUiLangService).lang;

  readonly summary  = input<IAnalyticsStats['summary'] | null>(null);
  /** Nombre de projets, affiché en premier (vue globale) quand renseigné. */
  readonly projects = input<number | null>(null);

  readonly loggedRatio = computed(() => {
    const s = this.summary();
    return s && s.visits ? Math.round((s.loggedInVisits / s.visits) * 100) : 0;
  });
}
