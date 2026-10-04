import { Component, computed, inject, input, output } from '@angular/core';
import { ITyroUiButtonGroupItem, TyroUiButtonGroup, TyroUiLangService } from 'tyrolium-ui';
import { AnalyticsPeriod } from '../../services/analytics.service';

/** Choix de la période des statistiques (7 / 30 / 90 jours / tout). */
@Component({
  selector: 'app-analytics-period',
  imports: [TyroUiButtonGroup],
  template: `
    <tyro-ui-button-group size="sm" [items]="items()" [value]="value()" (valueChange)="changed.emit($any($event))">
    </tyro-ui-button-group>
  `,
})
export class AnalyticsPeriodPicker {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly value   = input<AnalyticsPeriod>('30d');
  readonly changed = output<AnalyticsPeriod>();

  readonly items = computed<ITyroUiButtonGroupItem[]>(() => {
    const en = this.lang() === 'en';
    return [
      { value: '7d',  label: en ? '7 days'  : '7 jours'  },
      { value: '30d', label: en ? '30 days' : '30 jours' },
      { value: '90d', label: en ? '90 days' : '90 jours' },
      { value: 'all', label: en ? 'All'     : 'Tout'     },
    ];
  });
}
