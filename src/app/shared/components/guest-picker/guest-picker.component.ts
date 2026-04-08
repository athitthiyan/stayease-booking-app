import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GuestSelection {
  adults: number;
  children: number;
  infants: number;
}

@Component({
  selector: 'app-guest-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="guest-picker" [class.guest-picker--open]="open()">
      <button
        #triggerBtn
        type="button"
        class="guest-picker__trigger"
        [class.guest-picker__trigger--compact]="compact"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (keydown.escape)="close()"
        (keydown.arrowDown)="open() || toggle()"
      >
        <span class="guest-picker__summary">{{ summaryText }}</span>
        <span class="guest-picker__caret" [class.rotated]="open()">&#9662;</span>
      </button>
    </div>

    <!-- Fixed-position portal dropdown — rendered outside clipped parents -->
    @if (open()) {
      <div
        class="guest-picker__overlay"
        (click)="close()"
        (keydown.escape)="close()"
        role="presentation"
        tabindex="-1"
      ></div>
      <div
        #dropdownPanel
        class="guest-picker__dropdown"
        role="listbox"
        aria-label="Guest selection"
        (click)="$event.stopPropagation()"
        (keydown.escape)="close()"
        tabindex="-1"
        [style.top.px]="panelTop()"
        [style.left.px]="panelLeft()"
        [style.width.px]="panelWidth()"
      >
        <!-- Adults -->
        <div class="guest-picker__row">
          <div class="guest-picker__info">
            <span class="guest-picker__label">Adults</span>
            <span class="guest-picker__hint">Age 13+</span>
          </div>
          <div class="guest-picker__controls">
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="adults() <= 1"
              (click)="decrement('adults')"
              aria-label="Decrease adults"
            >&minus;</button>
            <span class="guest-picker__count" aria-live="polite">{{ adults() }}</span>
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="adults() + children() >= maxGuests"
              (click)="increment('adults')"
              aria-label="Increase adults"
            >+</button>
          </div>
        </div>

        <!-- Children -->
        <div class="guest-picker__row">
          <div class="guest-picker__info">
            <span class="guest-picker__label">Children</span>
            <span class="guest-picker__hint">Age 2 - 12</span>
          </div>
          <div class="guest-picker__controls">
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="children() <= 0"
              (click)="decrement('children')"
              aria-label="Decrease children"
            >&minus;</button>
            <span class="guest-picker__count" aria-live="polite">{{ children() }}</span>
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="adults() + children() >= maxGuests"
              (click)="increment('children')"
              aria-label="Increase children"
            >+</button>
          </div>
        </div>

        <!-- Infants -->
        <div class="guest-picker__row">
          <div class="guest-picker__info">
            <span class="guest-picker__label">Infants</span>
            <span class="guest-picker__hint">Under 2</span>
          </div>
          <div class="guest-picker__controls">
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="infants() <= 0"
              (click)="decrement('infants')"
              aria-label="Decrease infants"
            >&minus;</button>
            <span class="guest-picker__count" aria-live="polite">{{ infants() }}</span>
            <button
              type="button"
              class="guest-picker__btn"
              [disabled]="infants() >= maxInfants || infants() >= adults()"
              (click)="increment('infants')"
              aria-label="Increase infants"
            >+</button>
          </div>
        </div>

        <!-- Guest limit hint -->
        @if (adults() + children() >= maxGuests) {
          <div class="guest-picker__limit">Maximum {{ maxGuests }} guests reached</div>
        }
        @if (infants() >= adults()) {
          <div class="guest-picker__limit">Infants cannot exceed number of adults</div>
        }

        <div class="guest-picker__footer">
          <button type="button" class="guest-picker__done" (click)="close()">Done</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .guest-picker {
      position: relative;
      width: 100%;
    }

    .guest-picker__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--color-border, rgba(255,255,255,0.1));
      border-radius: var(--radius-md, 12px);
      background: var(--color-surface, rgba(17,24,39,0.6));
      color: var(--color-text, #f0f4ff);
      font-size: 14px;
      cursor: pointer;
      transition: border-color 0.2s ease;
    }

    .guest-picker__trigger:hover,
    .guest-picker__trigger:focus-visible {
      border-color: var(--color-primary, #d4af37);
      outline: none;
    }

    .guest-picker__trigger--compact {
      padding: 10px 14px;
      font-size: 14px;
      background: none;
      border: 1px solid var(--color-border, rgba(255,255,255,0.1));
    }

    .guest-picker__summary {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .guest-picker__caret {
      font-size: 10px;
      margin-left: 8px;
      transition: transform 0.2s ease;
      opacity: 0.6;
    }

    .guest-picker__caret.rotated {
      transform: rotate(180deg);
    }

    /* Full-screen invisible overlay for click-outside */
    .guest-picker__overlay {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: transparent;
    }

    /* Fixed-position dropdown — escapes all overflow:hidden parents */
    .guest-picker__dropdown {
      position: fixed;
      z-index: 9999;
      pointer-events: auto;
      min-width: 300px;
      background: rgba(12, 18, 32, 0.98);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 16px;
      box-shadow:
        0 20px 60px rgba(0,0,0,0.5),
        0 0 0 1px rgba(212,175,55,0.06);
      animation: guestPickerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes guestPickerSlideIn {
      from { opacity: 0; transform: translateY(-6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .guest-picker__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
    }

    .guest-picker__row + .guest-picker__row {
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .guest-picker__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .guest-picker__label {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text, #f0f4ff);
    }

    .guest-picker__hint {
      font-size: 12px;
      color: var(--color-text-muted, #8a9bbf);
    }

    .guest-picker__controls {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .guest-picker__btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid var(--color-border, rgba(255,255,255,0.15));
      background: rgba(255,255,255,0.04);
      color: var(--color-text, #f0f4ff);
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      user-select: none;
    }

    .guest-picker__btn:hover:not(:disabled) {
      border-color: var(--color-primary, #d4af37);
      background: rgba(212, 175, 55, 0.15);
      color: var(--color-primary, #d4af37);
    }

    .guest-picker__btn:active:not(:disabled) {
      transform: scale(0.92);
    }

    .guest-picker__btn:disabled {
      opacity: 0.2;
      cursor: not-allowed;
    }

    .guest-picker__count {
      font-size: 17px;
      font-weight: 700;
      min-width: 24px;
      text-align: center;
      color: var(--color-text, #f0f4ff);
    }

    .guest-picker__limit {
      font-size: 11px;
      color: var(--color-primary, #d4af37);
      text-align: center;
      padding: 6px 0 0;
      opacity: 0.8;
    }

    .guest-picker__footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      margin-top: 8px;
      padding-top: 14px;
      display: flex;
      justify-content: flex-end;
    }

    .guest-picker__done {
      padding: 10px 24px;
      border-radius: 999px;
      border: none;
      background: var(--gradient-gold, linear-gradient(135deg, #d4af37, #f0d58f));
      color: #111827;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .guest-picker__done:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    @media (max-width: 640px) {
      .guest-picker__dropdown {
        left: 16px !important;
        right: 16px !important;
        width: auto !important;
        min-width: unset;
      }
    }
  `],
})
export class GuestPickerComponent implements AfterViewInit, OnDestroy {
  @Input() maxGuests = 10;
  @Input() maxInfants = 4;
  @Input() compact = false;

  @Input() set value(val: GuestSelection) {
    if (val) {
      this.adults.set(val.adults);
      this.children.set(val.children);
      this.infants.set(val.infants);
    }
  }

  @Output() valueChange = new EventEmitter<GuestSelection>();

  @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;

  adults = signal(2);
  children = signal(0);
  infants = signal(0);
  open = signal(false);

  // Fixed-position panel coordinates
  panelTop = signal(0);
  panelLeft = signal(0);
  panelWidth = signal(300);

  private resizeObserver?: ResizeObserver;
  private scrollListener?: () => void;

  get summaryText(): string {
    const parts: string[] = [];
    const a = this.adults();
    const c = this.children();
    const i = this.infants();

    parts.push(`${a} Adult${a !== 1 ? 's' : ''}`);
    if (c > 0) parts.push(`${c} Child${c !== 1 ? 'ren' : ''}`);
    if (i > 0) parts.push(`${i} Infant${i !== 1 ? 's' : ''}`);

    return parts.join(', ');
  }

  get totalGuests(): number {
    return this.adults() + this.children();
  }

  private elementRef = inject(ElementRef);

  ngAfterViewInit(): void {
    // Watch for layout shifts that might move the trigger button
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.open()) this.positionPanel();
      });
      this.resizeObserver.observe(this.elementRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open()) this.close();
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.positionPanel();
      this.open.set(true);
      // Re-position on scroll (capture phase to catch scrollable containers)
      this.scrollListener = () => {
        if (this.open()) this.positionPanel();
      };
      window.addEventListener('scroll', this.scrollListener, true);
    }
  }

  close(): void {
    this.open.set(false);
    this.emit();
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
      this.scrollListener = undefined;
    }
  }

  increment(type: 'adults' | 'children' | 'infants'): void {
    if (type === 'infants') {
      if (this.infants() < this.maxInfants && this.infants() < this.adults()) {
        this.infants.update(v => v + 1);
      }
    } else if (this.adults() + this.children() < this.maxGuests) {
      this[type].update(v => v + 1);
    }
    this.emit();
  }

  decrement(type: 'adults' | 'children' | 'infants'): void {
    if (type === 'adults' && this.adults() > 1) {
      this.adults.update(v => v - 1);
      // Enforce infants <= adults
      if (this.infants() > this.adults()) {
        this.infants.set(this.adults());
      }
    } else if (type === 'children' && this.children() > 0) {
      this.children.update(v => v - 1);
    } else if (type === 'infants' && this.infants() > 0) {
      this.infants.update(v => v - 1);
    }
    this.emit();
  }

  /** Calculate fixed-position coordinates from trigger button's bounding rect */
  private positionPanel(): void {
    if (!this.triggerBtn) return;
    const rect = this.triggerBtn.nativeElement.getBoundingClientRect();
    const panelW = Math.max(300, rect.width);
    let left = rect.left;
    // Keep within viewport horizontally
    if (left + panelW > window.innerWidth - 16) {
      left = window.innerWidth - panelW - 16;
    }
    if (left < 16) left = 16;

    // Flip above trigger if not enough room below (estimated panel height ~320px)
    const estimatedPanelHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    if (spaceBelow < estimatedPanelHeight && spaceAbove > spaceBelow) {
      this.panelTop.set(rect.top - estimatedPanelHeight - 8);
    } else {
      this.panelTop.set(rect.bottom + 8);
    }
    this.panelLeft.set(left);
    this.panelWidth.set(panelW);
  }

  private emit(): void {
    this.valueChange.emit({
      adults: this.adults(),
      children: this.children(),
      infants: this.infants(),
    });
  }
}
