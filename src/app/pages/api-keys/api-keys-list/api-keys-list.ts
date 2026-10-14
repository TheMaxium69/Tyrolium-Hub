import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ITyroUiButtonGroupItem, ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiButtonGroup,
  TyroUiConfirmService, TyroUiDataTable, TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader, TyroUiSkeleton,
  TyroUiSnackbarService, TyroUiTextField,
} from 'tyrolium-ui';
import { ApiKeyStatusChip } from '../../../components/api-key-status/api-key-status';
import { HubUser } from '../../../components/hub-user/hub-user';
import { ApiKeyEnvironment, ApiKeyService, IApiKey, IApiKeyCreated } from '../../../services/api-key.service';
import { formatDate } from '../../../utils/format';

/** Clés API des systèmes tiers. Réservé au owner. */
@Component({
  selector: 'app-api-keys-list',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiButtonGroup,
    TyroUiTextField, TyroUiAlert, TyroUiSkeleton, ApiKeyStatusChip, HubUser,
  ],
  templateUrl: './api-keys-list.html',
  styleUrl: './api-keys-list.css',
})
export class ApiKeysList implements OnInit {
  readonly lang = inject(TyroUiLangService).lang;
  readonly service = inject(ApiKeyService);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly keys      = signal<IApiKey[]>([]);

  /* ─── Création ───────────────────────────────────────── */
  readonly createOpen  = signal(false);
  readonly creating    = signal(false);
  readonly createError = signal<string | null>(null);
  form = { label: '', environment: 'live' as ApiKeyEnvironment, content: '', expiresAt: '' };

  /**
   * Clé complète renvoyée UNE seule fois par l'API à la création.
   * Jamais stockée ailleurs que dans ce signal, vidé à la fermeture de la carte.
   */
  readonly revealed = signal<IApiKeyCreated | null>(null);

  readonly environmentItems = computed<ITyroUiButtonGroupItem[]>(() => [
    { value: 'live', label: 'Live', icon: 'ri-flashlight-line' },
    { value: 'test', label: 'Test', icon: 'ri-flask-line' },
  ]);

  readonly counts = computed(() => {
    const keys = this.keys();
    return {
      active:  keys.filter(k => this.service.status(k) === 'active').length,
      revoked: keys.filter(k => this.service.status(k) !== 'active').length,
    };
  });

  readonly columns: ITyroUiDataTableColumn[] = [
    { key: 'label',     label: 'Clé',          labelEn: 'Key',         sortable: true },
    { key: 'status',    label: 'Statut',       labelEn: 'Status',      sortable: true, filterable: true, width: '190px' },
    { key: 'perms',     label: 'Permissions',                          width: '120px', align: 'right' },
    { key: 'expiresAt', label: 'Expire le',    labelEn: 'Expires',     sortable: true, width: '150px' },
    { key: 'createdBy', label: 'Créée par',    labelEn: 'Created by',  width: '170px' },
    { key: 'actions',   label: '',                                     width: '110px', align: 'right' },
  ];

  readonly rows = computed(() => this.keys().map(k => ({
    id:        k.id,
    label:     `${k.label} ${k.keyPreview}`,
    status:    `${k.environment} ${this.service.status(k)}`,
    expiresAt: k.expiresAt ?? '9999',
    key:       k,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const res = await this.service.getAll();
      if (!res.success) throw new Error();
      this.keys.set(res.data ?? []);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  open(id: number) {
    this.router.navigate(['/cles-api', id]);
  }

  toggleCreate() {
    this.createOpen.update(v => !v);
    this.createError.set(null);
    this.form = { label: '', environment: 'live', content: '', expiresAt: '' };
  }

  async create(e?: Event) {
    e?.preventDefault();
    if (this.creating()) return;
    const en = this.lang() === 'en';
    if (!this.form.label.trim()) {
      this.createError.set(en ? 'The label is required.' : 'Le libellé est obligatoire.');
      return;
    }

    this.creating.set(true);
    this.createError.set(null);
    try {
      const res = await this.service.create({
        label:       this.form.label.trim(),
        environment: this.form.environment,
        content:     this.form.content.trim() || null,
        // Date seule saisie → fin de journée UTC.
        expiresAt:   this.form.expiresAt ? `${this.form.expiresAt}T23:59:59Z` : null,
      });
      if (!res.success || !res.data) {
        if (res.code !== 403) this.createError.set(res.errors?.[0]?.message ?? res.message);
        return;
      }
      // La liste ne garde que la clé sans son secret ; le secret ne vit que dans `revealed`.
      const { key: _secret, ...stored } = res.data;
      this.keys.update(list => [stored, ...list]);
      this.revealed.set(res.data);
      this.createOpen.set(false);
    } catch {
      this.createError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.creating.set(false);
    }
  }

  async copyKey() {
    const key = this.revealed()?.key;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      this.snackbar.show({ type: 'success', message: this.lang() === 'en' ? 'Key copied.' : 'Clé copiée.' });
    } catch {
      this.snackbar.show({ type: 'warning', message: this.lang() === 'en' ? 'Copy failed, select the key manually.' : 'Copie impossible, sélectionnez la clé manuellement.' });
    }
  }

  /** Fermeture de la carte : la clé est oubliée définitivement. */
  async dismissKey() {
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-eye-off-line',
      title:        en ? 'Hide the key for good?' : 'Masquer définitivement la clé ?',
      message:      en
        ? 'The full key will never be shown again. Make sure you have copied it somewhere safe.'
        : 'La clé complète ne sera plus jamais affichée. Vérifiez que vous l\'avez copiée en lieu sûr.',
      confirmLabel: en ? 'I have copied it' : 'Je l\'ai copiée',
      cancelLabel:  en ? 'Back' : 'Retour',
    });
    if (ok) this.revealed.set(null);
  }

  date(iso: string | null) { return iso ? formatDate(iso, this.lang()) : (this.lang() === 'en' ? 'Never' : 'Jamais'); }
}
