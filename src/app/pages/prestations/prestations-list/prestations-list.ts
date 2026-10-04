import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiDataTable, TyroUiDataTableColDef,
  TyroUiLangService, TyroUiPageHeader, TyroUiProgressBar, TyroUiSkeleton,
} from 'tyrolium-ui';
import { PrestationClient } from '../../../components/prestation-client/prestation-client';
import { PrestationStatusChip } from '../../../components/prestation-status/prestation-status';
import { IPrestation, PrestationService } from '../../../services/prestation.service';
import { formatDate, formatPrice } from '../../../utils/format';

@Component({
  selector: 'app-prestations-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiAlert,
    TyroUiSkeleton, TyroUiProgressBar, PrestationClient, PrestationStatusChip,
  ],
  templateUrl: './prestations-list.html',
  styleUrl: './prestations-list.css',
})
export class PrestationsList implements OnInit {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(PrestationService);
  private readonly router = inject(Router);

  readonly loading     = signal(true);
  readonly loadError   = signal(false);
  readonly prestations = signal<IPrestation[]>([]);

  readonly counts = computed(() => {
    const list   = this.prestations();
    const active = list.filter(p => p.status === 'active');
    return {
      total:   list.length,
      active:  active.length,
      pending: list.filter(p => p.status === 'pending').length,
      revenue: active.reduce((sum, p) => sum + (p.price ?? 0), 0),
    };
  });

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'client',    label: 'Client',                                 sortable: true },
    { key: 'offre',     label: 'Offre',      labelEn: 'Offer',           sortable: true, filterable: true },
    { key: 'status',    label: 'Statut',     labelEn: 'Status',          sortable: true, filterable: true, width: '140px' },
    { key: 'progress',  label: 'Avancement', labelEn: 'Progress',        sortable: true, width: '160px' },
    { key: 'price',     label: 'Prix',       labelEn: 'Price',           sortable: true, width: '120px', align: 'right' },
    { key: 'startedAt', label: 'Début',      labelEn: 'Started',         sortable: true, width: '140px' },
    { key: 'actions',   label: '',                                       width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => this.prestations().map(p => ({
    id:          p.id,
    client:      this.service.clientLabel(p),
    offre:       p.offre?.displayName ?? '-',
    status:      p.status,
    // Zéro-paddés : le tri du data-table compare des chaînes.
    progress:    String(p.progress).padStart(3, '0'),
    price:       p.price === null ? '' : String(p.price).padStart(12, '0'),
    startedAt:   p.startedAt ?? '',
    prestation:  p,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.service.getAllPrestations();
      if (!res.success) throw new Error();
      this.prestations.set(res.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number | 'nouvelle') {
    this.router.navigate(['/prestations', id]);
  }

  price(cents: number | null) { return formatPrice(cents, this.lang()); }
  date(iso: string | null) { return formatDate(iso, this.lang()); }
}
