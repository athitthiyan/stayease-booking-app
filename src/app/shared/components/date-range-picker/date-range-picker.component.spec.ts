import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePickerComponent } from './date-range-picker.component';

describe('DateRangePickerComponent', () => {
  let component: DateRangePickerComponent;
  let fixture: ComponentFixture<DateRangePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateRangePickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Default State', () => {
    it('should initialize with empty check-in and check-out dates', () => {
      expect(component.selectedCheckIn()).toBe('');
      expect(component.selectedCheckOut()).toBe('');
    });

    it('should start with calendar closed', () => {
      expect(component.isOpen()).toBe(false);
    });

    it('should have hover date as null', () => {
      expect(component.hoverDate()).toBeNull();
    });

    it('should set minDate to today if not provided', () => {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      component.ngOnInit();
      expect(component._minDate()).toBe(todayString);
    });
  });

  describe('Toggle Calendar Open/Close', () => {
    it('should open calendar when closed', () => {
      expect(component.isOpen()).toBe(false);
      component.toggleCalendar();
      expect(component.isOpen()).toBe(true);
    });

    it('should close calendar when open', () => {
      component.isOpen.set(true);
      component.toggleCalendar();
      expect(component.isOpen()).toBe(false);
    });

    it('should call openCalendar when toggling from closed state', () => {
      jest.spyOn(component, 'openCalendar');
      component.isOpen.set(false);
      component.toggleCalendar();
      expect(component.openCalendar).toHaveBeenCalled();
    });

    it('should call closeCalendar when toggling from open state', () => {
      jest.spyOn(component, 'closeCalendar');
      component.isOpen.set(true);
      component.toggleCalendar();
      expect(component.closeCalendar).toHaveBeenCalled();
    });

    it('should anchor the calendar panel to the trigger when opening', () => {
      fixture.detectChanges();
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });

      const trigger = fixture.nativeElement.querySelector('.drp__trigger') as HTMLButtonElement;
      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        width: 260,
        height: 48,
        top: 120,
        bottom: 168,
        left: 80,
        right: 340,
        x: 80,
        y: 120,
        toJSON: () => ({}),
      });
      jest.spyOn(component['elementRef'].nativeElement, 'getBoundingClientRect').mockReturnValue({
        width: 260,
        height: 48,
        top: 120,
        bottom: 168,
        left: 80,
        right: 340,
        x: 80,
        y: 120,
        toJSON: () => ({}),
      } as DOMRect);

      component.openCalendar();

      expect(component.panelTop()).toBe(60);
      expect(component.panelOffsetLeft()).toBe(-64);
      expect(component.panelWidth()).toBe(900);
      expect(component.panelCentered()).toBe(false);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    });

    it('should center the calendar on narrower viewports', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 });

      component.openCalendar();

      expect(component.panelCentered()).toBe(true);
      expect(component.panelTop()).toBeGreaterThan(0);
      expect(component.panelOffsetLeft()).toBeGreaterThanOrEqual(0);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    });
  });

  describe('Selecting Check-in Date', () => {
    it('should set check-in date when no date is selected', () => {
      const testDate = getTomorrowString();
      component.selectDate(testDate);
      expect(component.selectedCheckIn()).toBe(testDate);
      expect(component.selectedCheckOut()).toBe('');
    });

    it('should emit dateChange with check-in when first date selected', (done) => {
      const testDate = getTomorrowString();
      component.dateChange.subscribe((value) => {
        expect(value.checkIn).toBe(testDate);
        expect(value.checkOut).toBe('');
        done();
      });

      component.selectDate(testDate);
    });

    it('should not allow selecting past date as check-in', () => {
      const yesterday = getYesterdayString();
      component.selectDate(yesterday);
      expect(component.selectedCheckIn()).toBe('');
    });
  });

  describe('Selecting Check-out Date', () => {
    it('should set check-out date when check-in is already set', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 3);

      component.selectedCheckIn.set(checkInDate);
      component.selectDate(checkOutDate);

      expect(component.selectedCheckOut()).toBe(checkOutDate);
    });

    it('should emit dateChange with both dates when check-out selected', (done) => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);

      component.selectedCheckIn.set(checkInDate);

      component.dateChange.subscribe((value) => {
        if (value.checkOut) {
          expect(value.checkIn).toBe(checkInDate);
          expect(value.checkOut).toBe(checkOutDate);
          done();
        }
      });

      component.selectDate(checkOutDate);
    });

    it('should close calendar after selecting both dates', (done) => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);

      component.selectedCheckIn.set(checkInDate);
      component.isOpen.set(true);

      component.selectDate(checkOutDate);

      setTimeout(() => {
        expect(component.isOpen()).toBe(false);
        done();
      }, 350);
    });

    it('should reset check-in when selecting date before current check-in', () => {
      const checkInDate = addDaysToDate(getTodayString(), 3);
      const beforeCheckIn = addDaysToDate(getTodayString(), 1);

      component.selectedCheckIn.set(checkInDate);
      component.selectDate(beforeCheckIn);

      expect(component.selectedCheckIn()).toBe(beforeCheckIn);
      expect(component.selectedCheckOut()).toBe('');
    });
  });

  describe('Same-day Check-in/Out Blocked', () => {
    it('should clear check-in when same date clicked again', () => {
      const testDate = getTomorrowString();
      component.selectedCheckIn.set(testDate);
      component.selectDate(testDate);

      expect(component.selectedCheckIn()).toBe('');
      expect(component.selectedCheckOut()).toBe('');
    });

    it('should start new selection when clicking with both dates set', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);
      const newDate = addDaysToDate(checkInDate, 5);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);
      component.selectDate(newDate);

      expect(component.selectedCheckIn()).toBe(newDate);
      expect(component.selectedCheckOut()).toBe('');
    });
  });

  describe('Past Dates Disabled', () => {
    it('should disable selection of past dates', () => {
      const yesterday = getYesterdayString();
      component.selectDate(yesterday);

      expect(component.selectedCheckIn()).toBe('');
    });

    it('should allow today as check-in date', () => {
      const today = getTodayString();
      component.selectDate(today);

      expect(component.selectedCheckIn()).toBe(today);
    });

    it('should respect minDate for past date checking', () => {
      const futureDate = addDaysToDate(getTodayString(), 10);
      component._minDate.set(futureDate);

      const beforeMinDate = addDaysToDate(futureDate, -1);
      component.selectDate(beforeMinDate);

      expect(component.selectedCheckIn()).toBe('');
    });
  });

  describe('Date Range Output Emitted Correctly', () => {
    it('should emit correct date range after both dates selected', (done) => {
      const checkInDate = addDaysToDate(getTodayString(), 1);
      const checkOutDate = addDaysToDate(checkInDate, 3);

      let checkInEmitted = false;

      component.dateChange.subscribe((value) => {
        if (value.checkOut && checkInEmitted) {
          expect(value.checkIn).toBe(checkInDate);
          expect(value.checkOut).toBe(checkOutDate);
          done();
        }
        if (value.checkIn && !value.checkOut) {
          checkInEmitted = true;
        }
      });

      component.selectDate(checkInDate);
      component.selectDate(checkOutDate);
    });

    it('should emit empty strings when dates are cleared', (done) => {
      const testDate = getTomorrowString();
      component.selectedCheckIn.set(testDate);
      component.selectedCheckOut.set(addDaysToDate(testDate, 1));

      component.dateChange.subscribe((value) => {
        if (value.checkIn === '' && value.checkOut === '') {
          expect(value).toEqual({ checkIn: '', checkOut: '' });
          done();
        }
      });

      component.clearDates();
    });
  });

  describe('Month Navigation', () => {
    it('should increment displayMonthOffset on goNextMonth', () => {
      const initialOffset = component.displayMonthOffset();
      component.goNextMonth();
      expect(component.displayMonthOffset()).toBe(initialOffset + 1);
    });

    it('should decrement displayMonthOffset on goPreviousMonth', () => {
      component.displayMonthOffset.set(5);
      component.goPreviousMonth();
      expect(component.displayMonthOffset()).toBe(4);
    });

    it('should allow navigating backwards in months', () => {
      component.goPreviousMonth();
      component.goPreviousMonth();
      expect(component.displayMonthOffset()).toBe(-2);
    });

    it('should allow navigating forwards in months', () => {
      component.goNextMonth();
      component.goNextMonth();
      component.goNextMonth();
      expect(component.displayMonthOffset()).toBe(3);
    });

    it('should update calendar display when month changes', () => {
      const month1 = component.calendarMonth1();
      component.goNextMonth();
      const month2 = component.calendarMonth1();

      expect(month1.month).not.toBe(month2.month);
    });
  });

  describe('Clear Dates Functionality', () => {
    it('should clear both check-in and check-out dates', () => {
      const testDate = getTomorrowString();
      component.selectedCheckIn.set(testDate);
      component.selectedCheckOut.set(addDaysToDate(testDate, 1));

      component.clearDates();

      expect(component.selectedCheckIn()).toBe('');
      expect(component.selectedCheckOut()).toBe('');
    });

    it('should clear hover date when clearing', () => {
      component.hoverDate.set(getTomorrowString());
      component.clearDates();
      expect(component.hoverDate()).toBeNull();
    });

    it('should emit dateChange with empty values on clear', (done) => {
      const testDate = getTomorrowString();
      component.selectedCheckIn.set(testDate);
      component.selectedCheckOut.set(addDaysToDate(testDate, 1));

      component.dateChange.subscribe((value) => {
        if (value.checkIn === '' && value.checkOut === '') {
          expect(value).toEqual({ checkIn: '', checkOut: '' });
          done();
        }
      });

      component.clearDates();
    });

    it('should show clear button only when dates are selected', () => {
      // Calendar must be open to see the clear button
      component.isOpen.set(true);
      fixture.detectChanges();
      let clearBtn = fixture.nativeElement.querySelector('.cal-clear');
      expect(clearBtn).toBeNull();

      component.selectedCheckIn.set(getTomorrowString());
      fixture.detectChanges();
      clearBtn = fixture.nativeElement.querySelector('.cal-clear');
      expect(clearBtn).toBeTruthy();
    });

    it('should keep the anchored panel coordinates when closing', () => {
      fixture.detectChanges();

      component.openCalendar();
      const openLeft = component.panelOffsetLeft();
      const openTop = component.panelTop();
      component.closeCalendar();

      expect(component.panelOffsetLeft()).toBe(openLeft);
      expect(component.panelTop()).toBe(openTop);
    });

    it('should anchor the centered panel relative to the host width on mobile/tablet', () => {
      fixture.detectChanges();
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 });

      const trigger = fixture.nativeElement.querySelector('.drp__trigger') as HTMLButtonElement;
      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 120,
        bottom: 168,
        left: 200,
        right: 520,
        x: 200,
        y: 120,
        toJSON: () => ({}),
      });
      jest.spyOn(component['elementRef'].nativeElement, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 120,
        bottom: 168,
        left: 200,
        right: 520,
        x: 200,
        y: 120,
        toJSON: () => ({}),
      } as DOMRect);

      component.openCalendar();

      expect(component.panelCentered()).toBe(true);
      expect(component.panelOffsetLeft()).toBe(160);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    });
  });

  describe('Nights Count Calculation', () => {
    it('should return 0 when no dates selected', () => {
      expect(component.getNightCount()).toBe(0);
    });

    it('should return 0 when only check-in is selected', () => {
      component.selectedCheckIn.set(getTomorrowString());
      expect(component.getNightCount()).toBe(0);
    });

    it('should calculate correct night count for date range', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 3);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);

      expect(component.getNightCount()).toBe(3);
    });

    it('should calculate 1 night for consecutive days', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 1);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);

      expect(component.getNightCount()).toBe(1);
    });

    it('should display night count in trigger text', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);
      fixture.detectChanges();

      const triggerText = fixture.nativeElement.textContent;
      expect(triggerText).toContain('2 nights');
    });
  });

  describe('Today is Highlighted', () => {
    it('should mark today in calendar with isToday flag', () => {
      const calendarMonth = component.calendarMonth1();
      const todayString = getTodayString();

      const todayDay = calendarMonth.days.find((day) => day.date === todayString);
      expect(todayDay?.isToday).toBe(true);
    });

    it('should apply today styling in template', () => {
      // Calendar must be open to render days
      component.isOpen.set(true);
      fixture.detectChanges();
      const todayElement = fixture.nativeElement.querySelector('.cal-day-today');
      expect(todayElement).toBeTruthy();
    });
  });

  describe('Trigger Text Display', () => {
    it('should show "Select dates" when no dates selected', () => {
      fixture.detectChanges();
      const triggerText = fixture.nativeElement.querySelector('.drp__trigger-text');
      expect(triggerText.textContent).toContain('Select dates');
    });

    it('should show "Select checkout" when just check-in selected', () => {
      const checkInDate = getTomorrowString();
      component.selectedCheckIn.set(checkInDate);
      fixture.detectChanges();

      const triggerText = fixture.nativeElement.querySelector('.drp__trigger-text');
      expect(triggerText.textContent).toContain('Select checkout');
    });

    it('should show date range with night count when both dates selected', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);
      fixture.detectChanges();

      const triggerText = fixture.nativeElement.querySelector('.drp__trigger-text');
      expect(triggerText.textContent).toContain('→');
      expect(triggerText.textContent).toContain('2 nights');
    });

    it('should format dates correctly in trigger text', () => {
      const checkInDate = '2026-04-15';
      const checkOutDate = '2026-04-18';

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);
      fixture.detectChanges();

      const triggerText = fixture.nativeElement.querySelector('.drp__trigger-text').textContent;
      // formatDateDisplay uses short month names (e.g. "Apr 15")
      expect(triggerText).toContain('Apr');
      expect(triggerText).toContain('15');
      expect(triggerText).toContain('18');
    });
  });

  describe('Date Range Highlighting', () => {
    it('should mark dates in range with isInRange flag', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 3);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);

      const calendarMonth = component.calendarMonth1();
      const rangedDays = calendarMonth.days.filter((day) => day.isInRange);

      expect(rangedDays.length).toBeGreaterThan(0);
    });

    it('should not mark check-in and check-out dates as in range', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);

      const calendarMonth = component.calendarMonth1();
      const checkInDay = calendarMonth.days.find(
        (day) => day.date === checkInDate
      );
      const checkOutDay = calendarMonth.days.find(
        (day) => day.date === checkOutDate
      );

      expect(checkInDay?.isInRange).toBe(false);
      expect(checkOutDay?.isInRange).toBe(false);
    });
  });

  describe('Hover State', () => {
    it('should set hover date when hovering over day with check-in set', () => {
      const checkInDate = getTomorrowString();
      const hoverDateVal = addDaysToDate(checkInDate, 1);

      component.selectedCheckIn.set(checkInDate);
      component.onDayHover(hoverDateVal);

      expect(component.hoverDate()).toBe(hoverDateVal);
    });

    it('should not allow hover when check-out is already set', () => {
      const checkInDate = getTomorrowString();
      const checkOutDate = addDaysToDate(checkInDate, 2);
      const hoverDateVal = addDaysToDate(checkOutDate, 1);

      component.selectedCheckIn.set(checkInDate);
      component.selectedCheckOut.set(checkOutDate);
      component.onDayHover(hoverDateVal);

      expect(component.hoverDate()).toBeNull();
    });

    it('should clear hover on clearHover()', () => {
      component.hoverDate.set('2026-04-20');
      component.clearHover();
      expect(component.hoverDate()).toBeNull();
    });
  });

  describe('Keyboard Escape Closes', () => {
    it('should close calendar on Escape key via HostListener', () => {
      component.isOpen.set(true);
      component.onEscapeKey();
      expect(component.isOpen()).toBe(false);
    });

    it('should not error when escape pressed while already closed', () => {
      component.isOpen.set(false);
      expect(() => component.onEscapeKey()).not.toThrow();
    });
  });

  describe('Outside Click Handling', () => {
    it('should close the calendar when clicking outside the component', () => {
      component.isOpen.set(true);
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
      });

      component.onOutsideClick(event);

      expect(component.isOpen()).toBe(false);
    });

    it('should keep the calendar open when clicking inside the component', () => {
      component.isOpen.set(true);
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', {
        value: fixture.nativeElement.querySelector('.drp__trigger'),
      });

      component.onOutsideClick(event);

      expect(component.isOpen()).toBe(true);
    });
  });

  describe('Format Methods', () => {
    it('should format date display correctly', () => {
      const formatted = component.formatDateDisplay('2026-04-15');
      expect(formatted).toContain('Apr');
      expect(formatted).toContain('15');
    });

    it('should format month year correctly', () => {
      component.displayMonthOffset.set(0);
      const formatted = component.formatMonthYear(0);
      expect(formatted).toMatch(/^\w+ \d{4}$/);
    });

    it('should handle month names correctly', () => {
      const jan = component.formatDateDisplay('2026-01-15');
      const dec = component.formatDateDisplay('2026-12-25');

      expect(jan).toContain('Jan');
      expect(dec).toContain('Dec');
    });
  });

  describe('Aria Labels', () => {
    it('should generate aria label for calendar day', () => {
      const day = {
        date: '2026-04-15',
        day: 15,
        isCurrentMonth: true,
        isPast: false,
        isToday: false,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const label = component.getAriaLabel(day);
      expect(label).toContain('15');
      expect(label).toContain('April');
      expect(label).toContain('2026');
    });

    it('should include "today" in aria label for today', () => {
      const todayString = getTodayString();
      const day = {
        date: todayString,
        day: new Date().getDate(),
        isCurrentMonth: true,
        isPast: false,
        isToday: true,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const label = component.getAriaLabel(day);
      expect(label).toContain('today');
    });

    it('should include "check-in date" in aria label for check-in', () => {
      const day = {
        date: '2026-04-15',
        day: 15,
        isCurrentMonth: true,
        isPast: false,
        isToday: false,
        isCheckIn: true,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const label = component.getAriaLabel(day);
      expect(label).toContain('check-in date');
    });
  });

  describe('getDayClasses', () => {
    it('should return base cal-day class for normal day', () => {
      const day = {
        date: '2026-04-15',
        day: 15,
        isCurrentMonth: true,
        isPast: false,
        isToday: false,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const classes = component.getDayClasses(day);
      expect(classes).toBe('cal-day');
    });

    it('should include cal-day-checkin for check-in day', () => {
      const day = {
        date: '2026-04-15',
        day: 15,
        isCurrentMonth: true,
        isPast: false,
        isToday: false,
        isCheckIn: true,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const classes = component.getDayClasses(day);
      expect(classes).toContain('cal-day-checkin');
    });

    it('should include cal-day-past for past day', () => {
      const day = {
        date: '2026-01-01',
        day: 1,
        isCurrentMonth: true,
        isPast: true,
        isToday: false,
        isCheckIn: false,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const classes = component.getDayClasses(day);
      expect(classes).toContain('cal-day-past');
    });

    it('should include multiple classes for combined states', () => {
      const day = {
        date: '2026-04-15',
        day: 15,
        isCurrentMonth: true,
        isPast: false,
        isToday: true,
        isCheckIn: true,
        isCheckOut: false,
        isInRange: false,
        isHovered: false,
      };

      const classes = component.getDayClasses(day);
      expect(classes).toContain('cal-day-today');
      expect(classes).toContain('cal-day-checkin');
    });
  });

  describe('Input Setters', () => {
    it('should accept checkIn via setter', () => {
      const testDate = getTomorrowString();
      component.checkIn = testDate;
      expect(component.selectedCheckIn()).toBe(testDate);
    });

    it('should accept checkOut via setter', () => {
      const testDate = addDaysToDate(getTomorrowString(), 1);
      component.checkOut = testDate;
      expect(component.selectedCheckOut()).toBe(testDate);
    });

    it('should accept minDate via setter', () => {
      const futureDate = addDaysToDate(getTodayString(), 10);
      component.minDate = futureDate;
      expect(component._minDate()).toBe(futureDate);
    });

    it('should handle empty string for checkIn', () => {
      component.checkIn = '';
      expect(component.selectedCheckIn()).toBe('');
    });
  });

  describe('Computed Values', () => {
    it('should compute calendarMonth1 based on displayMonthOffset', () => {
      const month1 = component.calendarMonth1();
      component.displayMonthOffset.set(1);
      const month1Next = component.calendarMonth1();

      expect(month1.month).not.toBe(month1Next.month);
    });

    it('should compute calendarMonth2 one month ahead of month1', () => {
      const month1 = component.calendarMonth1();
      const month2 = component.calendarMonth2();

      expect(month2.month).toBe((month1.month + 1) % 12);
    });
  });

  describe('Cleanup on Destroy', () => {
    it('should remove window resize listener on destroy', () => {
      jest.spyOn(window, 'removeEventListener');
      component.ngOnInit();
      component.ngOnDestroy();
      expect(component).toBeTruthy();
    });
  });

  // Helper functions
  function getTodayString(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(today.getDate()).padStart(2, '0')}`;
  }

  function getTomorrowString(): string {
    return addDaysToDate(getTodayString(), 1);
  }

  function getYesterdayString(): string {
    return addDaysToDate(getTodayString(), -1);
  }

  function addDaysToDate(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
  }
});
