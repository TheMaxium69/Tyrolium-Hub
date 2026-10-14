import { Component, computed, inject, input } from '@angular/core';
import { TyroUiButton, TyroUiLangService, TyroUiSnackbarService } from 'tyrolium-ui';

/** Dépôt git : lien (nouvel onglet) si http(s), sinon texte + bouton « Copier » (git@…, ssh://…). */
@Component({
  selector: 'app-git-link',
  imports: [TyroUiButton],
  template: `
    @if (url(); as u) {
      @if (isWeb()) {
        <a class="gl-link" [href]="u" target="_blank" rel="noopener noreferrer">
          <i class="ri-git-repository-line"></i>
          <span>{{ label() }}</span>
          <i class="ri-external-link-line gl-ext"></i>
        </a>
      } @else {
        <span class="gl-text">
          <i class="ri-git-repository-line"></i>
          <code>{{ u }}</code>
          <tyro-ui-button size="sm" variant="ghost" icon="ri-file-copy-line"
            [title]="lang() === 'en' ? 'Copy' : 'Copier'" (clicked)="copy()"></tyro-ui-button>
        </span>
      }
    } @else {
      <span class="gl-none">{{ lang() === 'en' ? 'No repository' : 'Aucun dépôt' }}</span>
    }
  `,
  styles: `
    .gl-link, .gl-text { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .gl-link { color: var(--dash-accent); text-decoration: none; font-weight: 600; word-break: break-all; }
    .gl-link:hover span { text-decoration: underline; }
    .gl-ext { font-size: 0.8em; opacity: 0.7; }
    .gl-text { color: var(--dash-text); }
    .gl-text code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.8rem; word-break: break-all; }
    .gl-none { font-size: 0.8rem; color: var(--dash-text-muted); }
    :host-context([data-theme="dark"]) .gl-link { color: #60a5fa; }
  `,
})
export class GitLink {
  readonly lang = inject(TyroUiLangService).lang;
  private readonly snackbar = inject(TyroUiSnackbarService);

  readonly url = input<string | null>(null);

  readonly isWeb = computed(() => /^https?:\/\//.test(this.url() ?? ''));
  /** "https://github.com/TheMaxium69/exemple" → "github.com/TheMaxium69/exemple". */
  readonly label = computed(() => (this.url() ?? '').replace(/^https?:\/\//, '').replace(/\.git$/, '').replace(/\/$/, ''));

  async copy() {
    try {
      await navigator.clipboard.writeText(this.url() ?? '');
      this.snackbar.show({ type: 'success', message: this.lang() === 'en' ? 'Repository copied.' : 'Dépôt copié.' });
    } catch {
      this.snackbar.show({ type: 'warning', message: this.lang() === 'en' ? 'Copy failed.' : 'Copie impossible.' });
    }
  }
}
