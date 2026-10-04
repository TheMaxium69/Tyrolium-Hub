import { Component, inject, input } from '@angular/core';
import { TyroUiChip, TyroUiLangService } from 'tyrolium-ui';

/** Chips "niveau d'accès" (user / interne / owner) + "suspendu" d'un compte Useritium. */
@Component({
  selector: 'app-access-level',
  imports: [TyroUiChip],
  templateUrl: './access-level.html',
  styleUrl: './access-level.css',
})
export class AccessLevel {
  readonly lang = inject(TyroUiLangService).lang;

  readonly level  = input<'user' | 'interne' | 'owner'>('user');
  readonly banned = input(false);
}
