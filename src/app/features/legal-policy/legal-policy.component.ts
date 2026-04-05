import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type PolicySection = {
  heading: string;
  body: string;
};

type PolicyContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: PolicySection[];
};

@Component({
  selector: 'app-legal-policy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="policy-page">
      <div class="container policy-page__inner">
        <nav class="breadcrumb">
          <a routerLink="/">Home</a>
          <span>›</span>
          <span>{{ content().title }}</span>
        </nav>

        <p class="policy-page__eyebrow">{{ content().eyebrow }}</p>
        <h1>{{ content().title }}</h1>
        <p class="policy-page__intro">{{ content().intro }}</p>

        <div class="policy-page__card">
          @for (section of content().sections; track section.heading) {
            <article class="policy-page__section">
              <h2>{{ section.heading }}</h2>
              <p>{{ section.body }}</p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .policy-page {
      padding: 7rem 0 4rem;
      background:
        radial-gradient(circle at top right, rgba(201, 168, 76, 0.14), transparent 28%),
        linear-gradient(180deg, rgba(18, 22, 42, 0.98), rgba(11, 15, 30, 1));
      min-height: 100vh;
    }

    .policy-page__inner {
      max-width: 980px;
    }

    .policy-page__eyebrow {
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

    .policy-page__intro {
      max-width: 760px;
      margin-top: 1rem;
      color: var(--color-text-muted);
      font-size: 1.05rem;
      line-height: 1.8;
    }

    .policy-page__card {
      margin-top: 2rem;
      padding: 2rem;
      border-radius: 28px;
      border: 1px solid rgba(201, 168, 76, 0.2);
      background: rgba(22, 27, 49, 0.84);
      backdrop-filter: blur(16px);
      display: grid;
      gap: 1.5rem;
    }

    .policy-page__section h2 {
      color: var(--color-text);
      font-size: 1.1rem;
      margin-bottom: 0.55rem;
    }

    .policy-page__section p {
      color: var(--color-text-muted);
      line-height: 1.85;
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

    @media (max-width: 640px) {
      .policy-page {
        padding-top: 6.25rem;
      }

      .policy-page__card {
        padding: 1.4rem;
      }
    }
  `],
})
export class LegalPolicyComponent {
  private route = inject(ActivatedRoute);

  private readonly fallbackContent: PolicyContent = {
    eyebrow: 'Stayvora Policies',
    title: 'Policy Information',
    intro:
      'We keep Stayvora policies simple so guests and hotel partners know exactly how bookings, cancellations, data handling, and support work before money changes hands.',
    sections: [],
  };

  readonly content = computed<PolicyContent>(() => {
    return (this.route.snapshot.data['content'] as PolicyContent | undefined) ?? this.fallbackContent;
  });
}
