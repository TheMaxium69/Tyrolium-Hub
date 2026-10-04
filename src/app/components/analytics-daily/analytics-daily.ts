import { Component, computed, inject, input } from '@angular/core';
import { ITyroUiBarChartItem, TyroUiBarChart, TyroUiLangService } from 'tyrolium-ui';
import { IAnalyticsDay, IAnalyticsRange } from '../../services/analytics.service';

/** Visites par jour en diagramme en barres ; les jours sans visite de la période valent 0. */
@Component({
  selector: 'app-analytics-daily',
  imports: [TyroUiBarChart],
  template: `
    <tyro-ui-bar-chart
      [items]="items()"
      [valueLabel]="lang() === 'en' ? 'visits' : 'visites'"
      [emptyLabel]="lang() === 'en' ? 'No visit over this period.' : 'Aucune visite sur cette période.'">
    </tyro-ui-bar-chart>
  `,
})
export class AnalyticsDaily {
  readonly lang  = inject(TyroUiLangService).lang;
  readonly days  = input<IAnalyticsDay[]>([]);
  /** Période demandée : sert à compléter les jours sans visite. */
  readonly range = input<IAnalyticsRange>({});

  readonly items = computed<ITyroUiBarChartItem[]>(() => {
    const en     = this.lang() === 'en';
    const byDay  = new Map(this.days().map(d => [d.day, d]));
    const sorted = [...byDay.keys()].sort();
    const from   = this.range().from ?? sorted[0];
    const to     = this.range().to ?? sorted[sorted.length - 1];
    if (!from || !to) return [];

    const items: ITyroUiBarChartItem[] = [];
    for (const day of this.eachDay(from, to)) {
      const d = byDay.get(day);
      items.push({
        label:   this.label(day),
        value:   d?.visits ?? 0,
        details: [{ label: en ? 'unique visitors' : 'visiteurs uniques', value: d?.uniqueVisitors ?? 0 }],
      });
    }
    return items;
  });

  private *eachDay(from: string, to: string): Generator<string> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (day <= end) {
      yield `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      day.setDate(day.getDate() + 1);
    }
  }

  private label(day: string) {
    return new Date(`${day}T00:00:00`).toLocaleDateString(this.lang() === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'short',
    });
  }
}
