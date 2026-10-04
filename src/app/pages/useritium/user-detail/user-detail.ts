import { Component, computed, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TyroUiAlert, TyroUiAvatar, TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiConfirmService, TyroUiLangService,
  TyroUiSkeleton, TyroUiSnackbarService, TyroUiTextField,
} from 'tyrolium-ui';
import { AccessLevel } from '../../../components/access-level/access-level';
import { HubUser, hubUserName } from '../../../components/hub-user/hub-user';
import { apiAsset, IApiResponse } from '../../../config/api';
import { IUseritiumEmail, IUseritiumUser, UseritiumAdminService } from '../../../services/useritium-admin.service';
import { UserCardService } from '../../../services/user-card.service';
import { formatDateTime } from '../../../utils/format';

@Component({
  selector: 'app-user-detail',
  imports: [
    TyroUiBentoCard, TyroUiButton, TyroUiChip, TyroUiTextField, TyroUiAlert, TyroUiSkeleton, TyroUiAvatar,
    HubUser, AccessLevel,
  ],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.css',
})
export class UserDetail {
  readonly lang  = inject(TyroUiLangService).lang;
  readonly admin = inject(UseritiumAdminService);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly snackbar = inject(TyroUiSnackbarService);
  private readonly confirm  = inject(TyroUiConfirmService);
  private readonly cards    = inject(UserCardService);

  private id = 0;

  readonly loading   = signal(true);
  readonly notFound  = signal(false);
  readonly loadError = signal(false);
  readonly user      = signal<IUseritiumUser | null>(null);
  /** Action en cours (désactive tous les boutons). */
  readonly busy      = signal(false);

  readonly editable = computed(() => { const u = this.user(); return !!u && this.admin.isEditable(u); });
  readonly isSelf   = computed(() => { const u = this.user(); return !!u && this.admin.isSelf(u); });
  readonly avatar   = computed(() => apiAsset(this.user()?.pp));
  readonly name     = computed(() => hubUserName(this.user()));

  /* ─── Formulaires ────────────────────────────────────── */
  readonly editingUsername = signal(false);
  readonly usernameError   = signal<string | null>(null);
  newUsername = '';

  readonly editingDisplayName = signal(false);
  readonly displayNameError   = signal<string | null>(null);
  newDisplayName = '';

  readonly emailError = signal<string | null>(null);
  newEmail = '';

  banReason = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.id = Number(params.get('id'));
      this.load();
    });
  }

  async load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.notFound.set(false);
    this.user.set(null);
    this.editingUsername.set(false);
    this.usernameError.set(null);
    this.editingDisplayName.set(false);
    this.displayNameError.set(null);
    this.emailError.set(null);
    this.newEmail  = '';
    this.banReason = '';
    try {
      const res = await this.admin.getUser(this.id);
      if (res.code === 404) {
        this.notFound.set(true);
        return;
      }
      if (!res.success || !res.data) throw new Error();
      this.user.set(res.data);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    this.router.navigate(['/utilisateurs']);
  }

  /* ─── Pseudo ─────────────────────────────────────────── */

  startEditUsername() {
    this.newUsername = this.user()?.username ?? '';
    this.usernameError.set(null);
    this.editingUsername.set(true);
  }

  async saveUsername(e?: Event) {
    e?.preventDefault();
    const user     = this.user();
    const username = this.newUsername.trim();
    if (!user || !username || username === user.username || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      icon:         'ri-user-settings-line',
      title:        en ? 'Change the username?' : 'Changer le pseudo ?',
      message:      this.isSelf()
        ? (en
          ? `This is your account: you will be signed out and will have to sign in again as "${username}".`
          : `C'est votre compte : vous serez déconnecté et devrez vous reconnecter avec « ${username} ».`)
        : (en
          ? `All open sessions of ${user.username} will be invalidated: they will have to sign in again as "${username}". Remember to let them know.`
          : `Toutes les sessions ouvertes de ${user.username} seront invalidées : il devra se reconnecter avec « ${username} ». Pensez à le prévenir.`),
      confirmLabel: en ? 'Change' : 'Changer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const res = await this.run(() => this.admin.updateUsername(user.id, username), en ? 'Username updated.' : 'Pseudo mis à jour.', this.usernameError);
    if (res) {
      this.user.set(res);
      this.editingUsername.set(false);
    }
  }

  /* ─── Nom affiché ────────────────────────────────────── */

  startEditDisplayName() {
    this.newDisplayName = this.user()?.displayName ?? '';
    this.displayNameError.set(null);
    this.editingDisplayName.set(true);
  }

  /** Champ vide → null : le pseudo est alors affiché. */
  async saveDisplayName(e?: Event) {
    e?.preventDefault();
    const user = this.user();
    if (!user || this.busy()) return;

    const en          = this.lang() === 'en';
    const displayName = this.newDisplayName.trim() || null;
    if (displayName && displayName.length > 100) {
      this.displayNameError.set(en ? '100 characters maximum.' : '100 caractères maximum.');
      return;
    }

    const res = await this.run(
      () => this.admin.updateDisplayName(user.id, displayName),
      en ? 'Display name updated.' : 'Nom affiché mis à jour.',
      this.displayNameError,
    );
    if (res) {
      this.user.set(res);
      this.editingDisplayName.set(false);
    }
  }

  /* ─── Photo de profil ────────────────────────────────── */

  async removePp() {
    const user = this.user();
    if (!user?.pp || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-image-close-line',
      title:        en ? 'Remove the profile picture?' : 'Retirer la photo de profil ?',
      message:      en
        ? `The picture of ${this.name()} will be deleted. The default avatar will be shown instead.`
        : `La photo de ${this.name()} sera supprimée. L'avatar par défaut sera affiché à la place.`,
      confirmLabel: en ? 'Remove' : 'Retirer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const res = await this.run(() => this.admin.deletePp(user.id), en ? 'Profile picture removed.' : 'Photo de profil retirée.');
    if (res) this.user.set(res);
  }

  /* ─── Emails ─────────────────────────────────────────── */

  canDeleteEmail(email: IUseritiumEmail) {
    return !email.isDefault && (this.user()?.emails.length ?? 0) > 1;
  }

  async addEmail(e?: Event) {
    e?.preventDefault();
    const user  = this.user();
    const email = this.newEmail.trim();
    if (!user || !email || this.busy()) return;

    const en      = this.lang() === 'en';
    const created = await this.run(() => this.admin.addEmail(user.id, email), en ? `${email} added (not verified).` : `${email} ajouté (non vérifié).`, this.emailError);
    if (created) {
      this.newEmail = '';
      this.user.set({ ...user, emails: [...user.emails, created] });
    }
  }

  async deleteEmail(email: IUseritiumEmail) {
    const user = this.user();
    if (!user || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-mail-close-line',
      title:        en ? 'Remove this e-mail?' : 'Supprimer cet email ?',
      message:      en ? `${email.email} will be removed from ${user.username}'s account.` : `${email.email} sera retiré du compte de ${user.username}.`,
      confirmLabel: en ? 'Remove' : 'Supprimer',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const done = await this.run(() => this.admin.deleteEmail(user.id, email.id), en ? 'E-mail removed.' : 'Email supprimé.', this.emailError);
    if (done !== undefined) {
      this.user.set({ ...user, emails: user.emails.filter(e => e.id !== email.id) });
    }
  }

  /* ─── Sessions & suspension ──────────────────────────── */

  async revokeTokens() {
    const user = this.user();
    if (!user || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      icon:         'ri-logout-box-r-line',
      title:        en ? 'Sign out everywhere?' : 'Déconnecter partout ?',
      message:      en
        ? `All sessions of ${user.username} will be closed. The account stays active: they just have to sign in again.`
        : `Toutes les sessions de ${user.username} seront fermées. Le compte reste actif : il devra simplement se reconnecter.`,
      confirmLabel: en ? 'Sign out' : 'Déconnecter',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const res = await this.run(() => this.admin.revokeTokens(user.id), en ? 'All sessions closed.' : 'Toutes les sessions ont été fermées.');
    if (res) this.user.set(res);
  }

  async ban() {
    const user = this.user();
    if (!user || this.busy()) return;

    const en     = this.lang() === 'en';
    const reason = this.banReason.trim().slice(0, 500) || null;
    const ok     = await this.confirm.confirm({
      type:         'danger',
      icon:         'ri-forbid-line',
      title:        en ? `Suspend ${user.username}?` : `Suspendre ${user.username} ?`,
      message:      en
        ? 'All sessions are closed immediately and sign-in is refused until the account is reactivated.'
        : 'Toutes les sessions sont fermées immédiatement et la connexion est refusée jusqu\'à la réactivation du compte.',
      confirmLabel: en ? 'Suspend' : 'Suspendre',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const res = await this.run(() => this.admin.ban(user.id, reason), en ? 'Account suspended.' : 'Compte suspendu.');
    if (res) {
      this.user.set(res);
      this.banReason = '';
    }
  }

  async unban() {
    const user = this.user();
    if (!user || this.busy()) return;

    const en = this.lang() === 'en';
    const ok = await this.confirm.confirm({
      icon:         'ri-checkbox-circle-line',
      title:        en ? `Reactivate ${user.username}?` : `Réactiver ${user.username} ?`,
      message:      en ? 'The account will be able to sign in again.' : 'Le compte pourra de nouveau se connecter.',
      confirmLabel: en ? 'Reactivate' : 'Réactiver',
      cancelLabel:  en ? 'Cancel' : 'Annuler',
    });
    if (!ok) return;

    const res = await this.run(() => this.admin.unban(user.id), en ? 'Account reactivated.' : 'Compte réactivé.');
    if (res) this.user.set(res);
  }

  date(iso: string | null) { return formatDateTime(iso, this.lang()); }

  /**
   * Exécute une action : snackbar de succès, message d'erreur de l'API dans `errorTarget`
   * (ou en snackbar). 403 → rien d'affiché, les droits sont relus par HubAuthService.
   * Renvoie data (null pour une suppression) en cas de succès, undefined sinon.
   */
  private async run<T>(
    action: () => Promise<IApiResponse<T>>,
    success: string,
    errorTarget?: WritableSignal<string | null>,
  ): Promise<T | null | undefined> {
    this.busy.set(true);
    errorTarget?.set(null);
    try {
      const res = await action();
      if (!res.success) {
        if (res.code !== 403) {
          const message = res.errors?.[0]?.message ?? res.message;
          if (errorTarget) errorTarget.set(message);
          else this.snackbar.show({ type: 'danger', message });
        }
        return undefined;
      }
      this.snackbar.show({ type: 'success', message: success });
      // Pseudo, nom affiché ou suspension ont pu changer : la bulle "Détail" doit être rechargée.
      this.cards.invalidate(this.id);
      return res.data;
    } catch {
      const message = this.lang() === 'en' ? 'Unable to reach Tyrolium API.' : 'Impossible de contacter l\'API Tyrolium.';
      if (errorTarget) errorTarget.set(message);
      else this.snackbar.show({ type: 'danger', message });
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
