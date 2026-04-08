import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="coming-soon">
      <div class="coming-soon__glow coming-soon__glow--left"></div>
      <div class="coming-soon__glow coming-soon__glow--right"></div>

      <div class="coming-soon__card">
        <div class="coming-soon__eyebrow">Stayvora</div>
        <h1>Coming Soon</h1>
        <p class="coming-soon__lead">
          We are preparing a sharper Stayvora launch experience with curated stays,
          safer payments, and smoother booking journeys.
        </p>

        <div class="coming-soon__meta">
          <div class="coming-soon__meta-item">
            <span>What&apos;s next</span>
            <strong>Premium hotel discovery</strong>
          </div>
          <div class="coming-soon__meta-item">
            <span>Launch updates</span>
            <strong>support&#64;stayvora.co.in</strong>
          </div>
        </div>

        <div class="coming-soon__status">
          <span class="coming-soon__status-dot"></span>
          Public launch is temporarily paused while we finalize production readiness.
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(214, 184, 107, 0.18), transparent 36%),
        radial-gradient(circle at bottom right, rgba(90, 154, 255, 0.16), transparent 34%),
        linear-gradient(180deg, #09111d 0%, #0d1523 100%);
      color: #f4f2fb;
    }

    .coming-soon {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px 20px;
      overflow: hidden;
    }

    .coming-soon__glow {
      position: absolute;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      filter: blur(70px);
      opacity: 0.45;
      pointer-events: none;
    }

    .coming-soon__glow--left {
      top: -120px;
      left: -120px;
      background: rgba(214, 184, 107, 0.38);
    }

    .coming-soon__glow--right {
      right: -140px;
      bottom: -160px;
      background: rgba(96, 188, 255, 0.24);
    }

    .coming-soon__card {
      position: relative;
      width: min(100%, 760px);
      padding: 40px 28px;
      border-radius: 28px;
      border: 1px solid rgba(214, 184, 107, 0.18);
      background: rgba(11, 18, 31, 0.82);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(18px);
    }

    .coming-soon__eyebrow {
      display: inline-flex;
      margin-bottom: 18px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(214, 184, 107, 0.12);
      color: #e5ca7a;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.8rem, 7vw, 5.2rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }

    .coming-soon__lead {
      max-width: 580px;
      margin: 18px 0 0;
      color: rgba(230, 236, 252, 0.8);
      font-size: clamp(1rem, 2.5vw, 1.2rem);
      line-height: 1.7;
    }

    .coming-soon__meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 28px;
    }

    .coming-soon__meta-item {
      padding: 16px 18px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .coming-soon__meta-item span {
      display: block;
      margin-bottom: 8px;
      color: rgba(230, 236, 252, 0.55);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .coming-soon__meta-item strong {
      font-size: 1rem;
      font-weight: 600;
    }

    .coming-soon__status {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 26px;
      padding: 12px 16px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: rgba(230, 236, 252, 0.82);
      font-size: 0.95rem;
    }

    .coming-soon__status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #e5ca7a;
      box-shadow: 0 0 18px rgba(229, 202, 122, 0.7);
      flex-shrink: 0;
    }

    @media (max-width: 720px) {
      .coming-soon__card {
        padding: 28px 20px;
        border-radius: 22px;
      }

      .coming-soon__meta {
        grid-template-columns: 1fr;
      }

      .coming-soon__status {
        display: flex;
        align-items: flex-start;
        border-radius: 18px;
      }
    }
  `],
})
export class ComingSoonComponent {}
