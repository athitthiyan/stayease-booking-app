import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="support-page">
      <div class="container support-page__inner">
        <nav class="breadcrumb">
          <a routerLink="/">Home</a>
          <span>›</span>
          <span>Support</span>
        </nav>

        <p class="support-page__eyebrow">Support</p>
        <h1>Need help with a booking?</h1>
        <p class="support-page__intro">
          Our launch support team handles booking recovery, payment help, cancellation guidance,
          and refund follow-ups for both guests and hotel partners.
        </p>

        <div class="support-page__grid">
          <article class="support-card">
            <h2>Guest help</h2>
            <ul>
              <li>Failed payment or payment retry assistance</li>
              <li>Cancellation and refund guidance</li>
              <li>Booking change and active-hold recovery help</li>
            </ul>
          </article>

          <article class="support-card">
            <h2>Partner help</h2>
            <ul>
              <li>Inventory and pricing assistance</li>
              <li>Payout follow-up and settlement questions</li>
              <li>Booking disputes and support escalation</li>
            </ul>
          </article>
        </div>

        <div class="support-contact">
          <div>
            <span class="support-contact__label">Email support</span>
            <a href="mailto:support@stayvora.co.in">support@stayvora.co.in</a>
          </div>
          <div>
            <span class="support-contact__label">Response target</span>
            <p>Within 24 hours for booking, refund, and payout issues.</p>
          </div>
          <div>
            <span class="support-contact__label">Critical incidents</span>
            <p>Active payment or booking hold issues are triaged first.</p>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .support-page {
      padding: 7rem 0 4rem;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(201, 168, 76, 0.12), transparent 24%),
        linear-gradient(180deg, rgba(18, 22, 42, 0.98), rgba(11, 15, 30, 1));
    }

    .support-page__inner {
      max-width: 980px;
    }

    .support-page__eyebrow {
      margin-top: 1.5rem;
      color: var(--color-primary);
      font-size: 0.9rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
    }

    h1 {
      margin-top: 1rem;
      font-family: var(--font-serif);
      font-size: clamp(2.5rem, 5vw, 4.2rem);
      line-height: 1.05;
      color: var(--color-text);
    }

    .support-page__intro {
      max-width: 720px;
      margin-top: 1rem;
      color: var(--color-text-muted);
      font-size: 1.05rem;
      line-height: 1.8;
    }

    .support-page__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
      margin-top: 2rem;
    }

    .support-card,
    .support-contact {
      border-radius: 28px;
      border: 1px solid rgba(201, 168, 76, 0.2);
      background: rgba(22, 27, 49, 0.84);
      backdrop-filter: blur(16px);
    }

    .support-card {
      padding: 1.5rem;
    }

    .support-card h2 {
      color: var(--color-text);
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
    }

    .support-card ul {
      padding-left: 1rem;
      color: var(--color-text-muted);
      line-height: 1.9;
    }

    .support-contact {
      margin-top: 1.25rem;
      padding: 1.5rem;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .support-contact__label {
      display: block;
      margin-bottom: 0.45rem;
      color: var(--color-primary);
      font-size: 0.88rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
    }

    .support-contact a,
    .support-contact p {
      color: var(--color-text);
      line-height: 1.7;
    }

    .breadcrumb {
      display: flex;
      gap: 0.65rem;
      align-items: center;
      color: var(--color-text-subtle);
      font-size: 0.92rem;
    }

    .breadcrumb a {
      color: var(--color-text-muted);
    }

    @media (max-width: 780px) {
      .support-page__grid,
      .support-contact {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class SupportComponent {}
