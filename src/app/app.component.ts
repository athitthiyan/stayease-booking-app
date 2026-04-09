import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ActiveBookingCtaBarComponent } from './shared/components/active-booking-cta-bar/active-booking-cta-bar.component';
import { ComingSoonComponent } from './features/coming-soon/coming-soon.component';
import { AnalyticsService } from './core/services/analytics.service';
import { environment } from '../environments/environment';

export function shouldShowMaintenanceMode(hostname: string, config: { maintenanceMode: boolean; maintenanceHosts?: string[] }): boolean {
  if (config.maintenanceMode) {
    return true;
  }

  return (config.maintenanceHosts || []).includes(hostname.toLowerCase());
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ActiveBookingCtaBarComponent, ComingSoonComponent],
  template: `
    @if (maintenanceMode) {
      <app-coming-soon />
    } @else {
      <app-navbar />
      <app-active-booking-cta-bar />
      <main class="app-main">
        <router-outlet />
      </main>
      <app-footer />
    }
  `,
  styles: [`
    .app-main {
      min-height: 100vh;
    }
  `],
})
export class AppComponent implements OnInit {
  private analytics = inject(AnalyticsService);
  protected readonly maintenanceMode = shouldShowMaintenanceMode(globalThis.location?.hostname ?? '', environment);

  ngOnInit(): void {
    this.analytics.init();
  }
}
