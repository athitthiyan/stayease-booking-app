import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    <main class="app-main">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: [`
    .app-main {
      min-height: 100vh;
    }
  `],
})
export class AppComponent {}
