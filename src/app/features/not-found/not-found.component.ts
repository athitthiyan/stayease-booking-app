import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="not-found">
      <div class="not-found__card">
        <p class="not-found__eyebrow">Stayvora</p>
        <h1>Page not found</h1>
        <p class="not-found__copy">
          That link may be expired or incorrect. You can head back to search and continue your booking safely.
        </p>
        <div class="not-found__actions">
          <a routerLink="/search" class="btn btn--primary">Browse stays</a>
          <a routerLink="/" class="btn btn--ghost">Go home</a>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .not-found {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 96px 24px 32px;
      background:
        radial-gradient(circle at top, rgba(214, 186, 86, 0.14), transparent 32%),
        linear-gradient(180deg, #0b1020 0%, #121a2f 100%);
    }

    .not-found__card {
      max-width: 560px;
      width: 100%;
      padding: 40px 32px;
      border-radius: 28px;
      background: rgba(15, 20, 39, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 24px 60px rgba(5, 8, 18, 0.38);
      text-align: center;
      color: #f8fafc;
    }

    .not-found__eyebrow {
      margin: 0 0 12px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #d6ba56;
      font-size: 0.85rem;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 16px;
      font-size: clamp(2rem, 5vw, 3rem);
    }

    .not-found__copy {
      margin: 0 auto 24px;
      max-width: 42ch;
      color: rgba(226, 232, 240, 0.82);
      line-height: 1.65;
    }

    .not-found__actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 160px;
      padding: 14px 20px;
      border-radius: 999px;
      font-weight: 700;
      text-decoration: none;
      border: 1px solid transparent;
    }

    .btn--primary {
      background: linear-gradient(135deg, #f1de8b 0%, #d6ba56 100%);
      color: #101828;
      box-shadow: 0 16px 40px rgba(214, 186, 86, 0.3);
    }

    .btn--ghost {
      border-color: rgba(214, 186, 86, 0.6);
      color: #f8fafc;
      background: rgba(214, 186, 86, 0.08);
    }
  `],
})
export class NotFoundComponent {}
