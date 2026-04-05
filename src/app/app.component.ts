import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ActiveBookingCtaBarComponent } from './shared/components/active-booking-cta-bar/active-booking-cta-bar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ActiveBookingCtaBarComponent],
  template: `
    <app-navbar />
    <app-active-booking-cta-bar />
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
