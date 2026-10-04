import { Component, computed, inject, input } from '@angular/core';
import {
  ITyroUiDataTableColumn, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService,
} from 'tyrolium-ui';
import { IAnalyticsTopPage } from '../../services/analytics.service';

/** Top 10 des pages (calculé par l'API). */
@Component({
  selector: 'app-analytics-top-pages',
  imports: [TyroUiDataTable, TyroUiDataTableColDef],
  template: `
    @if (!pages().length) {
      <p class="atp-empty">{{ lang() === 'en' ? 'No visit over this period.' : 'Aucune visite sur cette période.' }}</p>
    } @else {
      <tyro-ui-data-table [columns]="columns" [data]="rows()">
        <ng-template tyroCol="uri" let-row>
          <code class="atp-code">{{ $any(row).uri }}</code>
        </ng-template>
        <ng-template tyroCol="visits" let-row>
          <strong>{{ $any(row).page.visits }}</strong>
        </ng-template>
        <ng-template tyroCol="uniqueVisitors" let-row>
          {{ $any(row).page.uniqueVisitors }}
        </ng-template>
      </tyro-ui-data-table>
    }
  `,
  styles: `
    .atp-code {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.8rem;
      padding: 0.1rem 0.4rem;
      border-radius: 6px;
      background: var(--dash-border);
      color: var(--dash-text);
    }
    .atp-empty {
      margin: 0;
      padding: 1.5rem 0;
      text-align: center;
      color: var(--dash-text-muted);
    }
  `,
})
export class AnalyticsTopPages {
  readonly lang  = inject(TyroUiLangService).lang;
  readonly pages = input<IAnalyticsTopPage[]>([]);

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'pageName',       label: 'Page' },
    { key: 'uri',            label: 'URI' },
    { key: 'visits',         label: 'Visites',  labelEn: 'Visits',  width: '100px', align: 'right' },
    { key: 'uniqueVisitors', label: 'Uniques',  labelEn: 'Unique',  width: '100px', align: 'right' },
  ];

  readonly rows = computed(() => this.pages().map(page => ({ pageName: page.pageName, uri: page.uri, page })));
}
