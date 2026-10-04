import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ITyroUiButtonGroupItem, ITyroUiSelectItem, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup,
  TyroUiConfirmService, TyroUiLangService, TyroUiPageHeader, TyroUiProgressBar, TyroUiSelect, TyroUiSkeleton,
  TyroUiSnackbarService, TyroUiTextField,
} from 'tyrolium-ui';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import { PrestationClient } from '../../../components/prestation-client/prestation-client';
import {
  prestationStatusIcon, prestationStatusLabel, PrestationStatusChip,
} from '../../../components/prestation-status/prestation-status';
import { IApiResponse } from '../../../config/api';
import {
  IOffre, IPrestation, IPrestationPayload, PRESTATION_STATUSES, PrestationService, PrestationStatus,
} from '../../../services/prestation.service';
import { IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';
import { formatDateTime, formatPrice, parsePrice, priceInput } from '../../../utils/format';

type ClientMode = 'account' | 'guest';

interface IPrestationForm {
  offreId:     string;
  clientMode:  ClientMode;
  /** id du compte choisi dans la liste ; '' = compte actuel conservé (ou aucun). */
  userId:      string;
  clientName:  string;
  clientEmail: string;
  status:      PrestationStatus;
  progress:    string;
  price:       string;
  content:     string;
}

/** Création (/prestations/nouvelle) et fiche/modification (/prestations/:id) d'une prestation. */
@Component({
  selector: 'app-prestation-form',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup, TyroUiTextField, TyroUiSelect,
    TyroUiProgressBar, TyroUiAlert, TyroUiSkeleton, HubUser, PrestationClient, PrestationStatusChip,
  ],
  templateUrl: './prestation-form.html',
  styleUrl: './prestation-form.css',
})
export class PrestationForm {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(PrestationService);
  private readonly users    = inject(UseritiumAdminService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  /** null : création. */
  readonly id = signal<number | null>(null);

  readonly loading    = signal(true);
  readonly notFound   = signal(false);
  readonly loadError  = signal(false);
  readonly saving     = signal(false);
  readonly formError  = signal<string | null>(null);
  readonly prestation = signal<IPrestation | null>(null);
  readonly offres     = signal<IOffre[]>([]);
  readonly accounts   = signal<IUseritiumUser[]>([]);

  form: IPrestationForm = this.emptyForm();

  readonly isNew    = computed(() => this.id() === null);
  /** Lecture seule sans le droit de modifier (ou de créer). */
  readonly readOnly = computed(() => !this.service.canPrestation(this.isNew() ? 'create' : 'update'));

  readonly offreItems = computed<ITyroUiSelectItem[]>(() => {
    const current = this.prestation()?.offre?.id;
    return this.offres()
      // Offres désactivées masquées, sauf celle déjà liée à la prestation.
      .filter(o => o.isActive || o.id === current)
      .map(o => ({ value: String(o.id), label: `${o.displayName}${o.price !== null ? ' · ' + formatPrice(o.price, this.lang()) : ''}`, icon: 'ri-price-tag-3-line' }));
  });

  readonly accountItems = computed<ITyroUiSelectItem[]>(() =>
    this.accounts().map(u => ({ value: String(u.id), label: `${hubUserName(u)} (@${u.username}) · ${this.users.defaultEmail(u)}`, icon: 'ri-user-line' })),
  );

  readonly statusItems = computed<ITyroUiSelectItem[]>(() =>
    PRESTATION_STATUSES.map(s => ({ value: s, label: prestationStatusLabel(s, this.lang()), icon: prestationStatusIcon(s) })),
  );

  readonly clientModeItems = computed<ITyroUiButtonGroupItem[]>(() => [
    {
      value: 'account', icon: 'ri-user-line',
      label: this.lang() === 'en' ? 'Useritium account' : 'Compte Useritium',
      // Sans accès à la liste des comptes, on ne peut que conserver le compte déjà lié.
      disabled: !this.service.canPickUser() && !this.prestation()?.user,
    },
    { value: 'guest', icon: 'ri-user-unfollow-line', label: this.lang() === 'en' ? 'Client without account' : 'Client sans compte' },
  ]);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const raw = params.get('id');
      this.id.set(raw === 'nouvelle' ? null : Number(raw));
      this.load();
    });
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.notFound.set(false);
    this.formError.set(null);
    this.prestation.set(null);
    try {
      const id = this.id();
      const [offres, prestation, accounts] = await Promise.all([
        this.service.getAllOffres(),
        id === null ? Promise.resolve(null) : this.service.getPrestation(id),
        this.service.canPickUser() ? this.users.getAllUsers() : Promise.resolve(null),
      ]);
      if (prestation?.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!offres.success || (prestation && (!prestation.success || !prestation.data))) throw new Error();

      this.offres.set(offres.data ?? []);
      this.accounts.set(accounts?.success ? accounts.data ?? [] : []);
      this.prestation.set(prestation?.data ?? null);
      this.form = prestation?.data ? this.toForm(prestation.data) : this.emptyForm();
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/prestations']);
  }

  /** Nouvelle offre choisie : reprend son prix si aucun prix n'est saisi. */
  onOffreChange(value: string) {
    this.form.offreId = value;
    const offre = this.offres().find(o => String(o.id) === value);
    if (offre && !this.form.price.trim()) this.form.price = priceInput(offre.price);
  }

  progressValue() {
    const n = Number(this.form.progress);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  }

  async save(e?: Event) {
    e?.preventDefault();
    if (this.saving() || this.readOnly()) return;

    const payload = this.toPayload();
    if (typeof payload === 'string') {
      this.formError.set(payload);
      return;
    }

    const en = this.lang() === 'en';
    const id = this.id();
    this.saving.set(true);
    this.formError.set(null);
    try {
      const res = id === null
        ? await this.service.createPrestation(payload)
        : await this.service.updatePrestation(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: id === null ? (en ? 'Service created.' : 'Prestation créée.') : (en ? 'Service updated.' : 'Prestation mise à jour.') });
      if (id === null) {
        this.router.navigate(['/prestations', res.data.id]);
      } else {
        this.prestation.set(res.data);
        this.form = this.toForm(res.data);
      }
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const p = this.prestation();
    if (!p) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? 'Delete this service?' : 'Supprimer cette prestation ?',
      message:      en
        ? `${p.offre.displayName} for ${this.service.clientLabel(p)} will be permanently deleted.`
        : `${p.offre.displayName} pour ${this.service.clientLabel(p)} sera définitivement supprimée.`,
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    try {
      const res = await this.service.deletePrestation(p.id);
      if (!res.success) {
        this.handleError(res);
        return;
      }
      this.snackbar.show({ type: 'success', message: en ? 'Service deleted.' : 'Prestation supprimée.' });
      this.back();
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  price(cents: number | null) { return formatPrice(cents, this.lang()); }
  date(iso: string | null) { return formatDateTime(iso, this.lang()); }

  /* ─── Formulaire ⇄ API ───────────────────────────────── */

  private emptyForm(): IPrestationForm {
    return {
      offreId: '', clientMode: this.service.canPickUser() ? 'account' : 'guest', userId: '',
      clientName: '', clientEmail: '', status: 'pending', progress: '0', price: '', content: '',
    };
  }

  private toForm(p: IPrestation): IPrestationForm {
    return {
      offreId:     String(p.offre?.id ?? ''),
      clientMode:  p.user ? 'account' : 'guest',
      // Compte lié présélectionné dans la liste (si on y a accès), sinon conservé tel quel.
      userId:      p.user?.id !== undefined && this.accounts().some(u => u.id === p.user!.id) ? String(p.user.id) : '',
      clientName:  p.clientName ?? '',
      clientEmail: p.clientEmail ?? '',
      status:      p.status,
      progress:    String(p.progress),
      price:       priceInput(p.price),
      content:     p.content ?? '',
    };
  }

  /** Payload validé, ou message d'erreur. */
  private toPayload(): IPrestationPayload | string {
    const en       = this.lang() === 'en';
    const f        = this.form;
    const progress = Number(f.progress);
    const price    = parsePrice(f.price);
    const current  = this.prestation();

    if (!f.offreId) return en ? 'Choose an offer.' : 'Choisissez une offre.';
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      return en ? 'Progress must be a whole number between 0 and 100.' : 'L\'avancement doit être un entier entre 0 et 100.';
    }
    if (Number.isNaN(price)) return en ? 'Invalid price.' : 'Prix invalide.';

    const payload: IPrestationPayload = {
      offreId: Number(f.offreId),
      status:  f.status,
      progress,
      price,
      content: f.content.trim() || null,
    };

    if (f.clientMode === 'account') {
      if (f.userId) payload.userId = Number(f.userId);
      else if (!current?.user) return en ? 'Choose a Useritium account.' : 'Choisissez un compte Useritium.';
      // userId omis : le compte déjà lié est conservé.
    } else {
      // Sans compte : le nom est obligatoire, l'email facultatif (validé par l'API s'il est saisi).
      if (!f.clientName.trim()) {
        return en ? 'The client name is required.' : 'Le nom du client est obligatoire.';
      }
      if (current?.user) payload.userId = null;
      payload.clientName  = f.clientName.trim();
      payload.clientEmail = f.clientEmail.trim() || null;
    }
    return payload;
  }

  /** 403 : rien d'affiché (droits relus). Sinon message de l'API. */
  private handleError(res: IApiResponse<unknown>) {
    if (res.code === 403) return;
    this.formError.set(res.errors?.[0]?.message ?? res.message);
  }
}
