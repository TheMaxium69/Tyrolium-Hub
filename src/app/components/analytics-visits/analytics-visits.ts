import { Component, computed, inject, input } from '@angular/core';
import {
  ITyroUiDataTableColumn, TyroUiChip, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService,
} from 'tyrolium-ui';
import { IAnalyticsInput } from '../../services/analytics.service';
import { formatDateTime } from '../../utils/format';

/** Tableau paginé des visites (pas de pagination côté API : tout est filtré/paginé ici). */
@Component({
  selector: 'app-analytics-visits',
  imports: [TyroUiDataTable, TyroUiDataTableColDef, TyroUiChip],
  templateUrl: './analytics-visits.html',
  styleUrl: './analytics-visits.css',
})
export class AnalyticsVisits {
  readonly lang = inject(TyroUiLangService).lang;

  readonly inputs      = input<IAnalyticsInput[]>([]);
  /** Masque la colonne "Site" quand on est déjà dans un projet. */
  readonly showProject = input(true);
  readonly pageSize    = input(15);

  readonly columns = computed<ITyroUiDataTableColumn[]>(() => [
    { key: 'createdAt', label: 'Date',                           sortable: true, width: '150px' },
    ...(this.showProject()
      ? [{ key: 'site', label: 'Site', sortable: true, filterable: true, width: '160px' }]
      : []),
    { key: 'pageName',  label: 'Page',                           sortable: true, filterable: true },
    { key: 'uri',       label: 'URI',                            sortable: true, filterable: true },
    { key: 'ip',        label: 'IP',                             sortable: true, filterable: true, width: '140px' },
    { key: 'isLogin',   label: 'Connecté', labelEn: 'Logged in', width: '110px', align: 'center' },
  ]);

  readonly rows = computed(() => this.inputs().map(i => ({
    createdAt: i.createdAt,
    site:      i.project?.domainNames?.[0] ?? i.project?.tag ?? '-',
    pageName:  i.pageName,
    uri:       i.uri,
    ip:        i.ip,
    isLogin:   i.isLogin,
  })));

  date(iso: string) { return formatDateTime(iso, this.lang()); }
}
