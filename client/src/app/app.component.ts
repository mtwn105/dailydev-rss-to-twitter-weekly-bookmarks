import { AuthService } from './services/auth.service';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'client';

  constructor(private route: ActivatedRoute,
    public authService: AuthService) {
    // Get Params
    const params = this.route.snapshot.queryParams;

    console.log(params);

  }

  signInWithTwitter() {
    this.authService.login();
  }

}
