import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  ITyroUiDataTableColumn, TyroUiAlert, TyroUiBentoCard, TyroUiButton, TyroUiConfirmService, TyroUiDataTable,
  TyroUiDataTableColDef, TyroUiLangService, TyroUiPageHeader, TyroUiSkeleton, TyroUiSnackbarService, TyroUiTextField,
} from 'tyrolium-ui';
import { IApiResponse } from '../../../config/api';
import { IServerType, IServerTypePayload, SolidServServerService } from '../../../services/solidserv-server.service';

interface ITypeForm {
  abbreviation: string;
  name:         string;
  namePrefix:   string;
  description:  string;
}

const EMPTY_FORM: ITypeForm = { abbreviation: '', name: '', namePrefix: '', description: '' };

/** Types de serveurs SolidServ (dénominations strictes : les serveurs s'appellent namePrefix + numéro). */
@Component({
  selector: 'app-solidserv-server-types',
  imports: [
    TyroUiPageHeader, TyroUiBentoCard, TyroUiDataTable, TyroUiDataTableColDef, TyroUiButton, TyroUiTextField,
    TyroUiAlert, TyroUiSkeleton,
  ],
  templateUrl: './server-types.html',
  styleUrl: './server-types.css',
})
export class SolidServServerTypes implements OnInit {
  readonly lang    = inject(TyroUiLangService).lang;
  readonly service = inject(SolidServServerService);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly types     = signal<IServerType[]>([]);
  /** Nombre de serveurs par type (uniquement si on peut voir le parc). */
  readonly usage     = signal<Map<number, number> | null>(null);

  /** null : fermé ; 0 : création ; id : modification. */
  readonly formId    = signal<number | null>(null);
  readonly saving    = signal(false);
  readonly formError = signal<string | null>(null);
  form: ITypeForm = { ...EMPTY_FORM };

  readonly columns = computed<ITyroUiDataTableColumn[]>(() => [
    { key: 'name',         label: 'Type',                                    sortable: true },
    { key: 'abbreviation', label: 'Abréviation',  labelEn: 'Abbreviation',   sortable: true, width: '140px' },
    { key: 'namePrefix',   label: 'Nommage',      labelEn: 'Naming',         sortable: true, width: '180px' },
    ...(this.usage() ? [{ key: 'servers', label: 'Serveurs', labelEn: 'Servers', sortable: true, width: '110px', align: 'right' as const }] : []),
    { key: 'actions',      label: '',                                        width: '110px', align: 'right' },
  ]);

  readonly rows = computed(() => this.types().map(t => ({
    name:         `${t.name} ${t.description ?? ''}`,
    abbreviation: t.abbreviation,
    namePrefix:   t.namePrefix,
    servers:      String(this.usage()?.get(t.id) ?? 0).padStart(6, '0'),
    type:         t,
  })));

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const [types, stats] = await Promise.all([
        this.service.getTypes(),
        this.service.canViewServers() ? this.service.getStats() : Promise.resolve(null),
      ]);
      if (!types.success) throw new Error();
      this.types.set(types.data ?? []);
      this.usage.set(stats?.success && stats.data ? new Map(stats.data.byType.map(t => [t.id, t.servers])) : null);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  servers(type: IServerType) { return this.usage()?.get(type.id) ?? 0; }

  openCreate() {
    this.form = { ...EMPTY_FORM };
    this.formError.set(null);
    this.formId.set(0);
  }

  openEdit(t: IServerType) {
    this.form = { abbreviation: t.abbreviation, name: t.name, namePrefix: t.namePrefix, description: t.description ?? '' };
    this.formError.set(null);
    this.formId.set(t.id);
  }

  closeForm() {
    this.formId.set(null);
    this.formError.set(null);
  }

  async save(e?: Event) {
    e?.preventDefault();
    const id = this.formId();
    if (id === null || this.saving()) return;

    const en = this.lang() === 'en';
    const abbreviation = this.form.abbreviation.trim().toLowerCase();
    const namePrefix   = this.form.namePrefix.trim().toLowerCase() || abbreviation;
    if (!/^[a-z]{2,10}$/.test(abbreviation)) {
      this.formError.set(en ? 'Abbreviation: 2 to 10 lowercase letters.' : 'Abréviation : 2 à 10 lettres minuscules.');
      return;
    }
    if (!/^[a-z]{2,20}$/.test(namePrefix)) {
      this.formError.set(en ? 'Name prefix: 2 to 20 lowercase letters.' : 'Préfixe de nom : 2 à 20 lettres minuscules.');
      return;
    }
    if (!this.form.name.trim()) {
      this.formError.set(en ? 'The name is required.' : 'Le nom est obligatoire.');
      return;
    }

    const payload: IServerTypePayload = {
      abbreviation,
      name:        this.form.name.trim(),
      namePrefix,
      description: this.form.description.trim() || null,
    };

    this.saving.set(true);
    this.formError.set(null);
    try {
      const res = id === 0 ? await this.service.createType(payload) : await this.service.updateType(id, payload);
      if (!res.success || !res.data) {
        this.handleError(res, msg => this.formError.set(msg));
        return;
      }
      const saved = res.data;
      this.types.update(list => id === 0 ? [...list, saved] : list.map(t => t.id === id ? saved : t));
      this.snackbar.show({ type: 'success', message: id === 0 ? (en ? 'Type created.' : 'Type créé.') : (en ? 'Type updated.' : 'Type mis à jour.') });
      this.closeForm();
    } catch {
      this.formError.set(en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(t: IServerType) {
    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-delete-bin-line',
      title:        en ? `Delete the ${t.name} type?` : `Supprimer le type ${t.name} ?`,
      message:      en
        ? 'Only possible if no server uses it.'
        : 'Possible uniquement si aucun serveur ne l\'utilise.',
      confirmLabel: en ? 'Delete' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;
    try {
      const res = await this.service.deleteType(t.id);
      if (!res.success) {
        this.handleError(res, msg => this.snackbar.show({ type: 'danger', message: msg }));
        return;
      }
      this.types.update(list => list.filter(x => x.id !== t.id));
      if (this.formId() === t.id) this.closeForm();
      this.snackbar.show({ type: 'success', message: en ? 'Type deleted.' : 'Type supprimé.' });
    } catch {
      this.snackbar.show({ type: 'danger', message: en ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.' });
    }
  }

  /** 403 : rien d'affiché. Sinon message de l'API (409 type utilisé, 422 doublon…). */
  private handleError(res: IApiResponse<unknown>, show: (message: string) => void) {
    if (res.code === 403) {
      this.closeForm();
      return;
    }
    show(res.errors?.[0]?.message ?? res.message);
  }
}
