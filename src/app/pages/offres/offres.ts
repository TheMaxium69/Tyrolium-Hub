import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  ITyroUiButtonGroupItem, ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup,
  TyroUiChip, TyroUiConfirmService, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader,
  TyroUiSkeleton, TyroUiSnackbarService, TyroUiSwitch, TyroUiTextField,
} from 'tyrolium-ui';
import { IApiResponse } from '../../config/api';
import { IOffre, IOffrePayload, OffreVisibility, PrestationService } from '../../services/prestation.service';
import { formatDate, formatPrice, parsePrice, priceInput } from '../../utils/format';

interface IOffreForm {
  tagName:     string;
  displayName: string;
  description: string;
  visibility:  OffreVisibility;
  price:       string;
  isActive:    boolean;
}

const EMPTY_FORM: IOffreForm = { tagName: '', displayName: '', description: '', visibility: 'listed', price: '', isActive: true };

@Component({
  selector: 'app-offres',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiButtonGroup,
    TyroUiChip, TyroUiTextField, TyroUiSwitch, TyroUiAlert, TyroUiSkeleton,
  ],
  templateUrl: './offres.html',
  styleUrl: './offres.css',
})
export class Offres implements OnInit {
  readonly lang     = inject(TyroUiLangService).lang;
  readonly service  = inject(PrestationService);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly offres    = signal<IOffre[]>([]);

  /* ─── Formulaire (création ou modification) ──────────── */
  /** null : fermé ; 0 : création ; id : modification. */
  readonly formId    = signal<number | null>(null);
  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);
  form: IOffreForm = { ...EMPTY_FORM };

  readonly counts = computed(() => {
    const offres = this.offres();
    return {
      total:  offres.length,
      active: offres.filter(o => o.isActive).length,
      listed: offres.filter(o => o.visibility === 'listed').length,
    };
  });

  readonly visibilityItems = computed<ITyroUiButtonGroupItem[]>(() => [
    { value: 'listed', label: this.lang() === 'en' ? 'Listed' : 'Catalogue', icon: 'ri-store-2-line' },
    { value: 'custom', label: this.lang() === 'en' ? 'Custom' : 'Sur mesure', icon: 'ri-magic-line' },
  ]);

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'displayName', label: 'Offre',      labelEn: 'Offer',      sortable: true },
    { key: 'visibility',  label: 'Visibilité', labelEn: 'Visibility', sortable: true, filterable: true, width: '140px' },
    { key: 'price',       label: 'Prix',       labelEn: 'Price',      sortable: true, width: '130px', align: 'right' },
    { key: 'isActive',    label: 'Statut',     labelEn: 'Status',     sortable: true, width: '120px' },
    { key: 'createdAt',   label: 'Créée le',   labelEn: 'Created',    sortable: true, width: '150px' },
    { key: 'actions',     label: '',                                  width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => this.offres().map(o => ({
    ...o,
    // Zéro-paddé : le tri du data-table compare des chaînes.
    price:    o.price === null ? '' : String(o.price).padStart(12, '0'),
    isActive: o.isActive ? 'active' : 'inactive',
    offre:    o,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.service.getAllOffres();
      if (!res.success) throw new Error();
      this.offres.set(res.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate() {
    this.form = { ...EMPTY_FORM };
    this.formError.set(null);
    this.formId.set(0);
  }

  openEdit(offre: IOffre) {
    this.form = {
      tagName:     offre.tagName,
      displayName: offre.displayName,
      description: offre.description ?? '',
      visibility:  offre.visibility,
      price:       priceInput(offre.price),
      isActive:    offre.isActive,
    };
    this.formError.set(null);
    this.formId.set(offre.id);
  }

  closeForm() {
    this.formId.set(null);
    this.formError.set(null);
  }

  async save(e?: Event) {
    e?.preventDefault();
    const id = this.formId();
    if (id === null || this.saving()) return;

    const en    = this.lang() === 'en';
    const price = parsePrice(this.form.price);
    if (!this.form.tagName.trim() || !this.form.displayName.trim()) {
      this.formError.set(en ? 'Tag and name are required.' : 'Le tag et le nom sont obligatoires.');
      return;
    }
    if (Number.isNaN(price)) {
      this.formError.set(en ? 'Invalid price.' : 'Prix invalide.');
      return;
    }

    const payload: IOffrePayload = {
      tagName:     this.form.tagName.trim(),
      displayName: this.form.displayName.trim(),
      description: this.form.description.trim() || null,
      visibility:  this.form.visibility,
      price,
      isActive:    this.form.isActive,
    };

    this.saving.set(true);
    this.formError.set(null);
    try {
      const res = id === 0 ? await this.service.createOffre(payload) : await this.service.updateOffre(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res, this.formError);
        return;
      }
      const saved = res.data;
      this.offres.update(list => id === 0 ? [saved, ...list] : list.map(o => o.id === id ? saved : o));
      this.snackbar.show({ type: 'success', message: id === 0 ? (en ? 'Offer created.' : 'Offre créée.') : (en ? 'Offer updated.' : 'Offre mise à jour.') });
      this.closeForm();
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(offre: IOffre) {
    const en  = this.lang() === 'en';
    try {
      const res = await this.service.updateOffre(offre.id, { isActive: !offre.isActive });
      if (!res.success || !res.data) {
        this.handleError(res);
        return;
      }
      const saved = res.data;
      this.offres.update(list => list.map(o => o.id === offre.id ? saved : o));
      this.snackbar.show({ type: 'success', message: saved.isActive ? (en ? 'Offer enabled.' : 'Offre activée.') : (en ? 'Offer disabled.' : 'Offre désactivée.') });
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  async remove(offre: IOffre) {
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? 'Delete this offer?' : 'Supprimer cette offre ?',
      message:      en
        ? `${offre.displayName} will be permanently removed from the catalogue.`
        : `${offre.displayName} sera définitivement retirée du catalogue.`,
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    try {
      const res = await this.service.deleteOffre(offre.id);
      // Offre encore liée à des prestations (409) : on propose de la désactiver à la place.
      if (res.code === 409 && offre.isActive && this.service.canOffre('update')) {
        const disable = await this.confirm.confirm({
          icon:         'ri-eye-off-line',
          title:        en ? 'Offer in use' : 'Offre utilisée',
          message:      en
            ? 'This offer is still linked to services and cannot be deleted. Disable it instead?'
            : 'Cette offre est encore liée à des prestations et ne peut pas être supprimée. La désactiver à la place ?',
          confirmLabel: en ? 'Disable' : 'Désactiver',
          cancelLabel:  en ? 'Cancel' : 'Annuler',
        });
        if (disable) await this.toggleActive(offre);
        return;
      }
      if (!res.success) {
        this.handleError(res);
        return;
      }
      this.offres.update(list => list.filter(o => o.id !== offre.id));
      if (this.formId() === offre.id) this.closeForm();
      this.snackbar.show({ type: 'success', message: en ? 'Offer deleted.' : 'Offre supprimée.' });
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  price(cents: number | null) { return formatPrice(cents, this.lang()); }
  date(iso: string) { return formatDate(iso, this.lang()); }

  /** 403 : rien d'affiché (droits relus, boutons masqués). Sinon message de l'API. */
  private handleError(res: IApiResponse<unknown>, target?: { set(v: string | null): void }) {
    if (res.code === 403) {
      this.closeForm();
      return;
    }
    const message = res.errors?.[0]?.message ?? res.message;
    if (target) target.set(message);
    else this.snackbar.show({ type: 'danger', message });
  }
}
