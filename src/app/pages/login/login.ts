import { Component, inject } from '@angular/core';
import { ITyroUiLoginCredentials, TyroUiLogin, TyroUiThemeService } from 'tyrolium-ui';
import { HubAuthService } from '../../services/hub-auth.service';

@Component({
  selector: 'app-login',
  imports: [TyroUiLogin],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  readonly auth = inject(HubAuthService);
  // Le layout n'est pas affiché ici : on instancie le service pour appliquer le thème mémorisé.
  private readonly theme = inject(TyroUiThemeService);

  onSubmit({ identifier, password }: ITyroUiLoginCredentials) {
    this.auth.login(identifier, password);
  }
}
