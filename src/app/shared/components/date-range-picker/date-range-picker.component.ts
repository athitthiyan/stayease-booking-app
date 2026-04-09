import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  signal,
  computed,
  inject,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isCheckIn: boolean;
  isCheckOut: boolean;
  isInRange: boolean;
  isHovered: boolean;
}

interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drp">
      <button
        #triggerBtn
        class="drp__trigger"
        (click)="toggleCalendar()"
        [attr.aria-expanded]="isOpen()"
        aria-label="Select check-in and check-out dates"
      >
        <span class="drp__trigger-text">
          @if (selectedCheckIn() && selectedCheckOut()) {
            {{ formatDateDisplay(selectedCheckIn()) }} → {{ formatDateDisplay(selectedCheckOut()) }}
            · {{ getNightCount() }} night{{ getNightCount() !== 1 ? 's' : '' }}
          } @else if (selectedCheckIn()) {
            {{ formatDateDisplay(selectedCheckIn()) }} → Select checkout
          } @else {
            Select dates
          }
        </span>
        <span class="drp__trigger-icon">📅</span>
      </button>

      @if (isOpen()) {
        <div
          class="drp__panel"
          [class.drp__panel--centered]="panelCentered()"
          [style.top.px]="panelTop()"
          [style.left.px]="panelOffsetLeft()"
          [style.width.px]="panelWidth()"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-label="Date range picker calendar"
          (keydown.escape)="closeCalendar()"
          tabindex="0"
        >
          <div class="cal-header">
            <button
              class="cal-nav"
              (click)="goPreviousMonth()"
              aria-label="Previous month"
            >◀</button>
            <div class="cal-title">
              @if (isMobileDevice()) {
                <h2 class="cal-month-name">
                  {{ formatMonthYear(displayMonthOffset()) }}
                </h2>
              } @else {
                <div class="cal-months-row">
                  <h2 class="cal-month-name">
                    {{ formatMonthYear(displayMonthOffset()) }}
                  </h2>
                  <h2 class="cal-month-name">
                    {{ formatMonthYear(displayMonthOffset() + 1) }}
                  </h2>
                </div>
              }
            </div>
            <button
              class="cal-nav"
              (click)="goNextMonth()"
              aria-label="Next month"
            >▶</button>
          </div>

          <div class="cal-container" [class.cal-container-dual]="!isMobileDevice()">
            <div class="cal-block">
              <div class="cal-weekdays">
                <div class="cal-wd">Su</div><div class="cal-wd">Mo</div>
                <div class="cal-wd">Tu</div><div class="cal-wd">We</div>
                <div class="cal-wd">Th</div><div class="cal-wd">Fr</div>
                <div class="cal-wd">Sa</div>
              </div>
              <div class="cal-grid">
                @for (day of calendarMonth1().days; track day.date) {
                  <button
                    [class]="getDayClasses(day)"
                    [disabled]="day.isPast || !day.isCurrentMonth"
                    (click)="selectDate(day.date)"
                    (mouseenter)="onDayHover(day.date)"
                    (mouseleave)="clearHover()"
                    [attr.aria-label]="getAriaLabel(day)"
                    [attr.aria-selected]="day.isCheckIn || day.isCheckOut"
                  >
                    <span class="cal-day-num">{{ day.day }}</span>
                    @if (day.isCheckIn) {
                      <span class="cal-day-badge">In</span>
                    }
                    @if (day.isCheckOut) {
                      <span class="cal-day-badge">Out</span>
                    }
                  </button>
                }
              </div>
            </div>

            @if (!isMobileDevice()) {
              <div class="cal-block">
                <div class="cal-weekdays">
                  <div class="cal-wd">Su</div><div class="cal-wd">Mo</div>
                  <div class="cal-wd">Tu</div><div class="cal-wd">We</div>
                  <div class="cal-wd">Th</div><div class="cal-wd">Fr</div>
                  <div class="cal-wd">Sa</div>
                </div>
                <div class="cal-grid">
                  @for (day of calendarMonth2().days; track day.date) {
                    <button
                      [class]="getDayClasses(day)"
                      [disabled]="day.isPast || !day.isCurrentMonth"
                      (click)="selectDate(day.date)"
                      (mouseenter)="onDayHover(day.date)"
                      (mouseleave)="clearHover()"
                      [attr.aria-label]="getAriaLabel(day)"
                      [attr.aria-selected]="day.isCheckIn || day.isCheckOut"
                    >
                      <span class="cal-day-num">{{ day.day }}</span>
                      @if (day.isCheckIn) {
                        <span class="cal-day-badge">In</span>
                      }
                      @if (day.isCheckOut) {
                        <span class="cal-day-badge">Out</span>
                      }
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <div class="cal-footer">
            @if (selectedCheckIn() && selectedCheckOut()) {
              <span class="cal-range-text">
                {{ formatDateDisplay(selectedCheckIn()) }} → {{ formatDateDisplay(selectedCheckOut()) }}
                · {{ getNightCount() }} night{{ getNightCount() !== 1 ? 's' : '' }}
              </span>
            }
            @if (selectedCheckIn() || selectedCheckOut()) {
              <button
                class="cal-clear"
                (click)="clearDates()"
                aria-label="Clear selected dates"
              >
                Clear dates
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .drp {
      position: relative;
      display: inline-block;
      width: 100%;
      overflow: visible;
    }

    .drp__trigger {
      width: 100%;
      padding: 4px 0;
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 15px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: opacity 0.2s ease;
      font-weight: 400;
    }

    .drp__trigger:hover { opacity: 0.8; }
    .drp__trigger:focus { outline: none; }

    .drp__trigger-text {
      flex: 1;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .drp__trigger-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .drp__panel {
      position: absolute;
      left: 0;
      z-index: 1200;
      background: rgba(12, 18, 32, 0.98);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
      padding: 28px;
      min-width: 340px;
      max-width: calc(100vw - 32px);
      max-height: min(560px, calc(100vh - 32px));
      overflow-y: auto;
      outline: none;
      animation: drpFadeIn 0.2s ease-out;
    }

    .drp__panel--centered {
      left: 50% !important;
      transform: translateX(-50%);
    }

    @keyframes drpFadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .drp__panel--centered {
      animation-name: drpFadeInCentered;
    }

    @keyframes drpFadeInCentered {
      from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      gap: 12px;
    }

    .cal-nav {
      width: 38px;
      height: 38px;
      border: none;
      background: rgba(212, 175, 55, 0.1);
      color: #d4af37;
      border-radius: 10px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .cal-nav:hover {
      background: rgba(212, 175, 55, 0.2);
      transform: scale(1.05);
    }

    .cal-title {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cal-months-row {
      display: flex;
      gap: 24px;
      width: 100%;
      justify-content: space-around;
    }

    .cal-month-name {
      font-size: 17px;
      font-weight: 700;
      color: #d4af37;
      margin: 0;
      text-align: center;
      min-width: 140px;
    }

    .cal-container {
      display: grid;
      gap: 20px;
    }

    .cal-container-dual {
      grid-template-columns: 1fr 1fr;
      gap: 28px;
    }

    .cal-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
      margin-bottom: 8px;
    }

    .cal-wd {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      text-transform: uppercase;
      letter-spacing: 1px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 44px);
      gap: 3px;
      justify-content: center;
    }

    .cal-day {
      width: 44px;
      height: 44px;
      border: none;
      background: transparent;
      color: #ffffff;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      overflow: hidden;
    }

    .cal-day:hover:not(.cal-day-past):not(:disabled) {
      background: rgba(212, 175, 55, 0.08);
      border-radius: 50%;
    }

    .cal-day:focus-visible {
      outline: 2px solid rgba(212, 175, 55, 0.5);
      outline-offset: 2px;
    }

    .cal-day:disabled { cursor: not-allowed; }
    .cal-day-other { opacity: 0; pointer-events: none; }
    .cal-day-past { opacity: 0.25; cursor: not-allowed; pointer-events: none; }

    .cal-day-today {
      box-shadow: inset 0 0 0 2px rgba(212, 175, 55, 0.4);
      border-radius: 12px;
    }

    .cal-day-checkin,
    .cal-day-checkout {
      background: linear-gradient(135deg, #d4af37, #f0d58f);
      color: #111827;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(212, 175, 55, 0.3);
      border-radius: 12px;
    }

    .cal-day-range {
      background: rgba(212, 175, 55, 0.12);
    }

    .cal-day-hover {
      background: rgba(212, 175, 55, 0.08);
    }

    .cal-day-range.cal-day-hover {
      background: rgba(212, 175, 55, 0.18);
    }

    .cal-day-num { font-size: 14px; line-height: 1; }

    .cal-day-badge {
      font-size: 9px;
      font-weight: 700;
      margin-top: 1px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .cal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      gap: 12px;
    }

    .cal-range-text {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      font-weight: 500;
    }

    .cal-clear {
      padding: 8px 16px;
      margin-left: auto;
      background: rgba(212, 175, 55, 0.1);
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #d4af37;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cal-clear:hover {
      background: rgba(212, 175, 55, 0.2);
      border-color: rgba(212, 175, 55, 0.5);
    }

    /* Mobile-first: default is mobile layout */
    .drp__panel {
      min-width: calc(100vw - 32px);
      max-width: calc(100vw - 32px);
      padding: 16px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .cal-grid {
      grid-template-columns: repeat(7, 1fr);
    }

    .cal-day { width: 100%; }
    .cal-month-name { font-size: 15px; min-width: auto; }

    /* sm (480px+) */
    @media (min-width: 480px) {
      .drp__panel {
        min-width: min(420px, calc(100vw - 32px));
        padding: 20px;
      }
    }

    /* md (768px+) */
    @media (min-width: 768px) {
      .drp__panel {
        min-width: auto;
        max-width: none;
        padding: 24px;
        max-height: none;
        overflow-y: visible;
      }
      .cal-month-name { font-size: 16px; }
    }
  `],
})
export class DateRangePickerComponent implements OnInit, OnDestroy {
  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @Input() set checkIn(value: string) { this.selectedCheckIn.set(value || ''); }
  @Input() set checkOut(value: string) { this.selectedCheckOut.set(value || ''); }
  @Input() set minDate(value: string) { this._minDate.set(value || ''); }
  @Output() dateChange = new EventEmitter<{ checkIn: string; checkOut: string }>();

  selectedCheckIn = signal('');
  selectedCheckOut = signal('');
  _minDate = signal('');
  isOpen = signal(false);
  displayMonthOffset = signal(0);
  hoverDate = signal<string | null>(null);
  panelTop = signal(0);
  panelOffsetLeft = signal(0);
  panelWidth = signal(900);
  panelCentered = signal(false);
  private _isMobile = signal(false);
  private resizeHandler = () => this.updateMobileStatus();

  calendarMonth1 = computed(() => this.generateCalendarMonth(this.displayMonthOffset()));
  calendarMonth2 = computed(() => this.generateCalendarMonth(this.displayMonthOffset() + 1));
  isMobileDevice = computed(() => this._isMobile());

  ngOnInit(): void {
    if (this.isBrowser) {
      if (!this._minDate()) {
        this._minDate.set(this.getTodayString());
      }
      this.updateMobileStatus();
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.closeCalendar();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && !this.elementRef.nativeElement.contains(target)) {
      this.closeCalendar();
    }
  }

  private updateMobileStatus(): void {
    if (this.isBrowser) {
      this._isMobile.set(window.innerWidth <= 768);
      if (this.isOpen()) {
        this.positionPanel();
      }
    }
  }

  toggleCalendar(): void {
    this.isOpen() ? this.closeCalendar() : this.openCalendar();
  }

  openCalendar(): void {
    this.isOpen.set(true);
    this.positionPanel();
    setTimeout(() => {
      const panel = this.elementRef.nativeElement.querySelector('.drp__panel') as HTMLElement | null;
      panel?.focus();
    });
  }

  closeCalendar(): void {
    this.isOpen.set(false);
  }

  goPreviousMonth(): void {
    this.displayMonthOffset.update((offset) => offset - 1);
  }

  goNextMonth(): void {
    this.displayMonthOffset.update((offset) => offset + 1);
  }

  selectDate(date: string): void {
    if (this.isPastDate(date)) return;

    const ci = this.selectedCheckIn();
    const co = this.selectedCheckOut();

    if (!ci) {
      this.selectedCheckIn.set(date);
      this.dateChange.emit({ checkIn: date, checkOut: '' });
      return;
    }

    if (!co) {
      if (this.compareDates(date, ci) < 0) {
        this.selectedCheckIn.set(date);
        this.dateChange.emit({ checkIn: date, checkOut: '' });
      } else if (this.compareDates(date, ci) === 0) {
        this.selectedCheckIn.set('');
        this.dateChange.emit({ checkIn: '', checkOut: '' });
      } else {
        this.selectedCheckOut.set(date);
        this.dateChange.emit({ checkIn: ci, checkOut: date });
        setTimeout(() => this.closeCalendar(), 300);
      }
      return;
    }

    this.selectedCheckIn.set(date);
    this.selectedCheckOut.set('');
    this.dateChange.emit({ checkIn: date, checkOut: '' });
  }

  onDayHover(date: string): void {
    if (this.selectedCheckIn() && !this.selectedCheckOut()) {
      this.hoverDate.set(date);
    }
  }

  clearHover(): void {
    this.hoverDate.set(null);
  }

  clearDates(): void {
    this.selectedCheckIn.set('');
    this.selectedCheckOut.set('');
    this.hoverDate.set(null);
    this.dateChange.emit({ checkIn: '', checkOut: '' });
  }

  getNightCount(): number {
    if (!this.selectedCheckIn() || !this.selectedCheckOut()) return 0;
    return Math.max(0, this.daysBetween(this.selectedCheckIn(), this.selectedCheckOut()));
  }

  getDayClasses(day: CalendarDay): string {
    const classes = ['cal-day'];
    if (!day.isCurrentMonth) classes.push('cal-day-other');
    if (day.isPast) classes.push('cal-day-past');
    if (day.isToday) classes.push('cal-day-today');
    if (day.isCheckIn) classes.push('cal-day-checkin');
    if (day.isCheckOut) classes.push('cal-day-checkout');
    if (day.isInRange) classes.push('cal-day-range');
    if (day.isHovered) classes.push('cal-day-hover');
    return classes.join(' ');
  }

  formatDateDisplay(date: string): string {
    if (!date) return '';
    const [, month, day] = date.split('-');
    const monthName = this.getMonthName(parseInt(month, 10) - 1);
    return `${monthName.slice(0, 3)} ${parseInt(day, 10)}`;
  }

  formatMonthYear(offset: number): string {
    const date = this.getDateForOffset(offset);
    return `${this.getMonthName(date.month)} ${date.year}`;
  }

  getAriaLabel(day: CalendarDay): string {
    const date = new Date(day.date + 'T00:00:00');
    let label = `${day.day} ${this.getMonthName(date.getMonth())} ${date.getFullYear()}`;
    if (day.isPast) label += ', past date';
    else if (day.isToday) label += ', today';
    if (day.isCheckIn) label += ', check-in date';
    else if (day.isCheckOut) label += ', check-out date';
    return label;
  }

  private positionPanel(): void {
    if (!this.isBrowser || !this.triggerBtn) {
      return;
    }

    const triggerRect = this.triggerBtn.nativeElement.getBoundingClientRect();
    const hostRect = this.elementRef.nativeElement.getBoundingClientRect();
    const hostWidth = Math.max(hostRect.width, triggerRect.width);
    const viewportPadding = 16;
    const centeredViewport = window.innerWidth <= 1024;
    const width = centeredViewport
      ? Math.min(window.innerWidth - viewportPadding * 2, 420)
      : Math.min(window.innerWidth - viewportPadding * 2, 900);
    const top = Math.max(this.triggerBtn.nativeElement.offsetHeight, triggerRect.height) + 12;

    this.panelWidth.set(width);
    this.panelTop.set(top);
    this.panelCentered.set(centeredViewport);

    if (centeredViewport) {
      this.panelOffsetLeft.set(hostWidth / 2);
      return;
    }

    let leftOffset = -120;
    const minLocalLeft = viewportPadding - hostRect.left;
    const maxLocalLeft = window.innerWidth - viewportPadding - hostRect.left - width;

    if (leftOffset < minLocalLeft) {
      leftOffset = minLocalLeft;
    }
    if (leftOffset > maxLocalLeft) {
      leftOffset = maxLocalLeft;
    }

    this.panelOffsetLeft.set(leftOffset);
  }

  private generateCalendarMonth(offset: number): CalendarMonth {
    const { year, month } = this.getDateForOffset(offset);
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const current = new Date(startDate);

    for (let index = 0; index < 42; index++) {
      const dateStr = this.formatDateString(current);
      const isCurrentMonth = current.getMonth() === month;
      const isPast = this.isPastDate(dateStr);
      const isToday = dateStr === this.getTodayString();
      const isCheckIn = dateStr === this.selectedCheckIn();
      const isCheckOut = dateStr === this.selectedCheckOut();
      const isInRange = !!(
        this.selectedCheckIn()
        && this.selectedCheckOut()
        && this.isDateInRange(dateStr, this.selectedCheckIn(), this.selectedCheckOut())
      );
      const isHovered = !!(
        this.selectedCheckIn()
        && !this.selectedCheckOut()
        && this.hoverDate()
        && this.compareDates(dateStr, this.selectedCheckIn()) >= 0
        && this.compareDates(dateStr, this.hoverDate()!) <= 0
      );

      days.push({
        date: dateStr,
        day: current.getDate(),
        isCurrentMonth,
        isPast,
        isToday,
        isCheckIn,
        isCheckOut,
        isInRange,
        isHovered,
      });

      current.setDate(current.getDate() + 1);
    }

    return { year, month, days };
  }

  private getDateForOffset(offset: number): { year: number; month: number } {
    const today = new Date();
    const month = today.getMonth() + offset;
    return {
      year: today.getFullYear() + Math.floor(month / 12),
      month: ((month % 12) + 12) % 12,
    };
  }

  private formatDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTodayString(): string {
    return this.formatDateString(new Date());
  }

  private isPastDate(dateStr: string): boolean {
    const minDate = this._minDate();
    if (minDate && this.compareDates(dateStr, minDate) < 0) return true;
    return this.compareDates(dateStr, this.getTodayString()) < 0;
  }

  private compareDates(first: string, second: string): number {
    return first.localeCompare(second);
  }

  private isDateInRange(dateStr: string, start: string, end: string): boolean {
    return dateStr > start && dateStr < end;
  }

  private daysBetween(start: string, end: string): number {
    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const difference = new Date(endYear, endMonth - 1, endDay).getTime()
      - new Date(startYear, startMonth - 1, startDay).getTime();
    return Math.floor(difference / (1000 * 60 * 60 * 24));
  }

  private getMonthName(monthIndex: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[monthIndex] || '';
  }
}
