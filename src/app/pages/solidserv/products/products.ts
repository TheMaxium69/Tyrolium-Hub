import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  ITyroUiButtonGroupItem, ITyroUiDataTableColumn, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton,
  TyroUiButtonGroup, TyroUiChip, TyroUiConfirmService, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService,
  TyroUiPageHeader, TyroUiSelect, TyroUiSkeleton, TyroUiSnackbarService, TyroUiSwitch, TyroUiTextField,
} from 'tyrolium-ui';
import { IApiResponse } from '../../../config/api';
import { IOffre, PrestationService } from '../../../services/prestation.service';
import {
  ISolidServProduct, ISolidServProductPayload, SolidServProductService, SolidServVisibility,
} from '../../../services/solidserv-product.service';
import { formatPrice, parsePrice, priceInput } from '../../../utils/format';

interface IProductForm {
  tagName:      string;
  displayName:  string;
  description:  string;
  visibility:   SolidServVisibility;
  priceMonthly: string;
  priceYearly:  string;
  cpuCores:     string;
  ramMb:        string;
  storageGb:    string;
  stock:        string;
  position:     string;
  isActive:     boolean;
  offreId:      string;
}

const EMPTY_FORM: IProductForm = {
  tagName: '', displayName: '', description: '', visibility: 'listed', priceMonthly: '', priceYearly: '',
  cpuCores: '', ramMb: '', storageGb: '', stock: '', position: '0', isActive: true, offreId: '',
};

/** Catalogue des produits SolidServ (VPS, dédiés, stockage, sur-mesure). */
@Component({
  selector: 'app-solidserv-products',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiButtonGroup,
    TyroUiChip, TyroUiTextField, TyroUiSelect, TyroUiSwitch, TyroUiAlert, TyroUiSkeleton,
  ],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class SolidServProducts implements OnInit {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(SolidServProductService);
  private readonly prestation = inject(PrestationService);
  private readonly snackbar   = inject(TyroUiSnackbarService);
  private readonly confirm    = inject(TyroUiConfirmService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly products  = signal<ISolidServProduct[]>([]);
  readonly offres    = signal<IOffre[]>([]);

  /* ─── Formulaire (création ou modification) ──────────── */
  /** null : fermé ; 0 : création ; id : modification. */
  readonly formId    = signal<number | null>(null);
  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);
  form: IProductForm = { ...EMPTY_FORM };

  readonly counts = computed(() => {
    const p = this.products();
    return {
      total:      p.length,
      active:     p.filter(x => x.isActive).length,
      outOfStock: p.filter(x => x.isActive && !x.inStock).length,
      custom:     p.filter(x => x.visibility === 'custom').length,
    };
  });

  readonly visibilityItems = computed<ITyroUiButtonGroupItem[]>(() => [
    { value: 'listed', label: this.lang() === 'en' ? 'Public' : 'Public',     icon: 'ri-store-2-line' },
    { value: 'custom', label: this.lang() === 'en' ? 'Custom' : 'Sur mesure', icon: 'ri-magic-line' },
  ]);

  readonly offreItems = computed<ITyroUiSelectItem[]>(() => [
    { value: '', label: this.lang() === 'en' ? 'No linked offer' : 'Aucune offre liée' },
    ...this.offres().map(o => ({ value: String(o.id), label: `${o.displayName} · ${o.tagName}`, icon: 'ri-price-tag-3-line' })),
  ]);

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'position',    label: '#',                                       sortable: true, width: '60px', align: 'right' },
    { key: 'displayName', label: 'Produit',     labelEn: 'Product',         sortable: true },
    { key: 'specs',       label: 'Ressources',  labelEn: 'Resources',       width: '230px' },
    { key: 'price',       label: 'Prix',        labelEn: 'Price',           sortable: true, width: '150px', align: 'right' },
    { key: 'stock',       label: 'Stock',                                   sortable: true, width: '130px' },
    { key: 'state',       label: 'Statut',      labelEn: 'Status',          sortable: true, filterable: true, width: '170px' },
    { key: 'actions',     label: '',                                        width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => this.products().map(p => ({
    // Zéro-paddés : le tri du data-table compare des chaînes.
    position:    String(p.position).padStart(6, '0'),
    displayName: `${p.displayName} ${p.tagName}`,
    price:       p.priceMonthly === null ? '' : String(p.priceMonthly).padStart(12, '0'),
    stock:       p.stock === null ? 'zzz' : String(p.stock).padStart(8, '0'),
    state:       `${p.isActive ? 'actif active' : 'désactivé disabled'} ${p.visibility} ${p.inStock ? '' : 'rupture out'}`,
    product:     p,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [products, offres] = await Promise.all([
        this.service.getAll(),
        this.service.canPickOffre() ? this.prestation.getAllOffres() : Promise.resolve(null),
      ]);
      if (!products.success) throw new Error();
      this.products.set(products.data ?? []);
      this.offres.set(offres?.success ? offres.data ?? [] : []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate() {
    const next = Math.max(0, ...this.products().map(p => p.position)) + 1;
    this.form = { ...EMPTY_FORM, position: String(next) };
    this.formError.set(null);
    this.formId.set(0);
  }

  openEdit(p: ISolidServProduct) {
    this.form = {
      tagName:      p.tagName,
      displayName:  p.displayName,
      description:  p.description ?? '',
      visibility:   p.visibility,
      priceMonthly: priceInput(p.priceMonthly),
      priceYearly:  priceInput(p.priceYearly),
      cpuCores:     p.cpuCores?.toString() ?? '',
      ramMb:        p.ramMb?.toString() ?? '',
      storageGb:    p.storageGb?.toString() ?? '',
      stock:        p.stock?.toString() ?? '',
      position:     String(p.position),
      isActive:     p.isActive,
      offreId:      p.offre ? String(p.offre.id) : '',
    };
    this.formError.set(null);
    this.formId.set(p.id);
  }

  closeForm() {
    this.formId.set(null);
    this.formError.set(null);
  }

  async save(e?: Event) {
    e?.preventDefault();
    const id = this.formId();
    if (id === null || this.saving()) return;

    const payload = this.toPayload();
    if (typeof payload === 'string') {
      this.formError.set(payload);
      return;
    }

    const en = this.lang() === 'en';
    this.saving.set(true);
    this.formError.set(null);
    try {
      const res = id === 0 ? await this.service.create(payload) : await this.service.update(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res, msg => this.formError.set(msg));
        return;
      }
      this.snackbar.show({ type: 'success', message: id === 0 ? (en ? 'Product created.' : 'Produit créé.') : (en ? 'Product updated.' : 'Produit mis à jour.') });
      this.closeForm();
      await this.reload();
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(p: ISolidServProduct) {
    const en = this.lang() === 'en';
    try {
      const res = await this.service.update(p.id, { isActive: !p.isActive });
      if (!res.success || !res.data) {
        this.handleError(res, msg => this.snackbar.show({ type: 'danger', message: msg }));
        return;
      }
      this.snackbar.show({ type: 'success', message: res.data.isActive ? (en ? 'Product enabled.' : 'Produit activé.') : (en ? 'Product disabled.' : 'Produit désactivé.') });
      await this.reload();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  async remove(p: ISolidServProduct) {
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? 'Delete this product?' : 'Supprimer ce produit ?',
      message:      en
        ? `${p.displayName} will be permanently removed from the catalogue. To just stop selling it, disable it instead.`
        : `${p.displayName} sera définitivement retiré du catalogue. Pour simplement arrêter de le vendre, désactivez-le plutôt.`,
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    try {
      const res = await this.service.delete(p.id);
      // Produit utilisé par un serveur (409, quand le Dashboard existera) : on propose de le désactiver.
      if (res.code === 409 && p.isActive && this.service.can('update')) {
        const disable = await this.confirm.confirm({
          icon:         'ri-eye-off-line',
          title:        en ? 'Product in use' : 'Produit utilisé',
          message:      en
            ? 'This product is still used by servers and cannot be deleted. Disable it instead?'
            : 'Ce produit est encore utilisé par des serveurs et ne peut pas être supprimé. Le désactiver à la place ?',
          confirmLabel: en ? 'Disable' : 'Désactiver',
          cancelLabel:  en ? 'Cancel' : 'Annuler',
        });
        if (disable) await this.toggleActive(p);
        return;
      }
      if (!res.success) {
        this.handleError(res, msg => this.snackbar.show({ type: 'danger', message: msg }));
        return;
      }
      if (this.formId() === p.id) this.closeForm();
      this.snackbar.show({ type: 'success', message: en ? 'Product deleted.' : 'Produit supprimé.' });
      await this.reload();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  price(cents: number | null) { return formatPrice(cents, this.lang()); }
  ram(mb: number | null) { return this.service.formatRam(mb, this.lang()); }
  storage(gb: number | null) { return this.service.formatStorage(gb, this.lang()); }

  /** Rechargement silencieux : l'ordre (position) peut avoir changé. */
  private async reload() {
    const res = await this.service.getAll();
    if (res.success) this.products.set(res.data ?? []);
  }

  /** Payload validé (entiers réels, bornes de l'API), ou message d'erreur. */
  private toPayload(): ISolidServProductPayload | string {
    const en = this.lang() === 'en';
    const f  = this.form;
    if (!f.tagName.trim() || !f.displayName.trim()) {
      return en ? 'Tag and name are required.' : 'Le tag et le nom sont obligatoires.';
    }

    const priceMonthly = parsePrice(f.priceMonthly);
    const priceYearly  = parsePrice(f.priceYearly);
    if (Number.isNaN(priceMonthly) || Number.isNaN(priceYearly)) return en ? 'Invalid price.' : 'Prix invalide.';

    /** "" → null ; sinon entier >= min, ou NaN. */
    const int = (value: string, min: number): number | null => {
      if (!value.trim()) return null;
      const n = Number(value.trim());
      return Number.isInteger(n) && n >= min ? n : NaN;
    };
    const cpuCores  = int(f.cpuCores, 1);
    const ramMb     = int(f.ramMb, 1);
    const storageGb = int(f.storageGb, 1);
    const stock     = int(f.stock, 0);
    const position  = int(f.position, 0) ?? 0;
    if ([cpuCores, ramMb, storageGb].some(n => Number.isNaN(n))) {
      return en ? 'CPU, RAM and storage must be whole numbers greater than 0.' : 'CPU, RAM et stockage doivent être des entiers supérieurs à 0.';
    }
    if (Number.isNaN(stock) || Number.isNaN(position)) {
      return en ? 'Stock and position must be whole numbers ≥ 0.' : 'Le stock et la position doivent être des entiers ≥ 0.';
    }

    return {
      tagName:      f.tagName.trim(),
      displayName:  f.displayName.trim(),
      description:  f.description.trim() || null,
      visibility:   f.visibility,
      priceMonthly,
      priceYearly,
      cpuCores,
      ramMb,
      storageGb,
      stock,
      position,
      isActive:     f.isActive,
      offreId:      f.offreId ? Number(f.offreId) : null,
    };
  }

  /** 403 : rien d'affiché (droits relus, boutons masqués). Sinon message de l'API. */
  private handleError(res: IApiResponse<unknown>, show: (message: string) => void) {
    if (res.code === 403) {
      this.closeForm();
      return;
    }
    show(res.errors?.[0]?.message ?? res.message);
  }
}
