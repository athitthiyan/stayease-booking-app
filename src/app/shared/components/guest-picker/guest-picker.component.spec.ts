import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuestPickerComponent, GuestSelection } from './guest-picker.component';

describe('GuestPickerComponent', () => {
  let component: GuestPickerComponent;
  let fixture: ComponentFixture<GuestPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuestPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GuestPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Default State', () => {
    it('should initialize with 2 adults, 0 children, 0 infants', () => {
      expect(component.adults()).toBe(2);
      expect(component.children()).toBe(0);
      expect(component.infants()).toBe(0);
    });

    it('should start with dropdown closed', () => {
      expect(component.open()).toBe(false);
    });

    it('should have default maxGuests of 10', () => {
      expect(component.maxGuests).toBe(10);
    });

    it('should have default maxInfants of 4', () => {
      expect(component.maxInfants).toBe(4);
    });
  });

  describe('Summary Text Formatting', () => {
    it('should display "2 Adults" for default state', () => {
      expect(component.summaryText).toBe('2 Adults');
    });

    it('should display "1 Adult" for single adult', () => {
      component.adults.set(1);
      expect(component.summaryText).toBe('1 Adult');
    });

    it('should display "2 Adults, 1 Child" when children = 1', () => {
      component.children.set(1);
      expect(component.summaryText).toBe('2 Adults, 1 Child');
    });

    it('should display "2 Adults, 2 Children" when children = 2', () => {
      component.children.set(2);
      expect(component.summaryText).toBe('2 Adults, 2 Children');
    });

    it('should display "2 Adults, 1 Child, 1 Infant" with all guest types', () => {
      component.children.set(1);
      component.infants.set(1);
      expect(component.summaryText).toBe('2 Adults, 1 Child, 1 Infant');
    });

    it('should display "2 Adults, 1 Child, 2 Infants" with multiple infants', () => {
      component.children.set(1);
      component.infants.set(2);
      expect(component.summaryText).toBe('2 Adults, 1 Child, 2 Infants');
    });

    it('should display only adults and infants when children = 0', () => {
      component.infants.set(2);
      expect(component.summaryText).toBe('2 Adults, 2 Infants');
    });
  });

  describe('Adults Increment/Decrement', () => {
    it('should increment adults', () => {
      component.increment('adults');
      expect(component.adults()).toBe(3);
    });

    it('should decrement adults', () => {
      component.decrement('adults');
      expect(component.adults()).toBe(1);
    });

    it('should not decrement adults below 1', () => {
      component.adults.set(1);
      component.decrement('adults');
      expect(component.adults()).toBe(1);
    });

    it('should not increment adults beyond maxGuests when children are present', () => {
      component.maxGuests = 5;
      component.adults.set(4);
      component.children.set(1);
      component.increment('adults');
      expect(component.adults()).toBe(4); // 4 + 1 = 5, already at max
    });

    it('should allow incrementing adults up to maxGuests when no children', () => {
      component.maxGuests = 5;
      component.children.set(0);
      component.adults.set(4);
      component.increment('adults');
      expect(component.adults()).toBe(5);
    });

    it('should auto-adjust infants when adults decremented below infant count', () => {
      component.adults.set(2);
      component.infants.set(2);
      component.decrement('adults');
      expect(component.adults()).toBe(1);
      expect(component.infants()).toBe(1); // Auto-reduced to match adults
    });
  });

  describe('Children Increment/Decrement', () => {
    it('should increment children', () => {
      component.children.set(0);
      component.increment('children');
      expect(component.children()).toBe(1);
    });

    it('should decrement children', () => {
      component.children.set(1);
      component.decrement('children');
      expect(component.children()).toBe(0);
    });

    it('should not decrement children below 0', () => {
      component.children.set(0);
      component.decrement('children');
      expect(component.children()).toBe(0);
    });

    it('should not increment children beyond maxGuests when adults present', () => {
      component.maxGuests = 3;
      component.adults.set(2);
      component.children.set(1);
      component.increment('children');
      expect(component.children()).toBe(1); // 2 + 1 = 3, already at max
    });

    it('should allow incrementing children up to maxGuests', () => {
      component.maxGuests = 5;
      component.adults.set(2);
      component.children.set(2);
      component.increment('children');
      expect(component.children()).toBe(3);
    });
  });

  describe('Infants Increment/Decrement', () => {
    it('should increment infants', () => {
      component.infants.set(0);
      component.increment('infants');
      expect(component.infants()).toBe(1);
    });

    it('should decrement infants', () => {
      component.infants.set(1);
      component.decrement('infants');
      expect(component.infants()).toBe(0);
    });

    it('should not decrement infants below 0', () => {
      component.infants.set(0);
      component.decrement('infants');
      expect(component.infants()).toBe(0);
    });

    it('should not increment infants beyond maxInfants', () => {
      component.maxInfants = 2;
      component.infants.set(2);
      component.increment('infants');
      expect(component.infants()).toBe(2);
    });

    it('should not increment infants beyond adult count', () => {
      component.adults.set(2);
      component.infants.set(2);
      component.increment('infants');
      expect(component.infants()).toBe(2); // Cannot exceed adults
    });

    it('should allow incrementing infants up to maxInfants and adult count', () => {
      component.adults.set(3);
      component.maxInfants = 4;
      component.infants.set(2);
      component.increment('infants');
      expect(component.infants()).toBe(3);
    });
  });

  describe('Max Guests Limit', () => {
    it('should enforce maxGuests limit for adults + children', () => {
      component.maxGuests = 4;
      component.adults.set(3);
      component.children.set(1);
      expect(component.totalGuests).toBe(4);
      component.increment('adults');
      expect(component.adults()).toBe(3); // Should not increment
    });

    it('should allow custom maxGuests input', () => {
      component.maxGuests = 8;
      component.adults.set(5);
      component.children.set(2);
      expect(component.totalGuests).toBe(7);
      component.increment('children');
      expect(component.children()).toBe(3);
    });

    it('should display limit message when max reached', () => {
      component.maxGuests = 3;
      component.adults.set(2);
      component.children.set(1);
      component.toggle();
      fixture.detectChanges();
      const limitText = fixture.nativeElement.textContent;
      expect(limitText).toContain('Maximum 3 guests reached');
    });
  });

  describe('Toggle Open/Close', () => {
    it('should open dropdown when calling toggle() from closed state', () => {
      expect(component.open()).toBe(false);
      component.toggle();
      expect(component.open()).toBe(true);
    });

    it('should close dropdown when calling toggle() from open state', () => {
      component.open.set(true);
      component.toggle();
      expect(component.open()).toBe(false);
    });

    it('should keep the dropdown open without binding scroll listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      component.toggle();
      expect(component.open()).toBe(true);
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('scroll', expect.any(Function), true);
    });
  });

  describe('Done Button Closes and Emits', () => {
    it('should close dropdown when Done is clicked', () => {
      component.open.set(true);
      component.close();
      expect(component.open()).toBe(false);
    });

    it('should emit valueChange when Done is clicked', (done) => {
      component.adults.set(3);
      component.children.set(1);
      component.infants.set(1);

      component.valueChange.subscribe((value: GuestSelection) => {
        expect(value.adults).toBe(3);
        expect(value.children).toBe(1);
        expect(value.infants).toBe(1);
        done();
      });

      component.close();
    });

    it('should emit current values on close', (done) => {
      component.adults.set(4);
      component.children.set(2);
      component.infants.set(0);

      component.valueChange.subscribe((value: GuestSelection) => {
        expect(value).toEqual({
          adults: 4,
          children: 2,
          infants: 0,
        });
        done();
      });

      component.close();
    });
  });

  describe('Value Input Sets Counts', () => {
    it('should set adults, children, infants from value input', () => {
      const testValue: GuestSelection = {
        adults: 3,
        children: 2,
        infants: 1,
      };

      component.value = testValue;

      expect(component.adults()).toBe(3);
      expect(component.children()).toBe(2);
      expect(component.infants()).toBe(1);
    });

    it('should handle null value input gracefully', () => {
      component.adults.set(2);
      component.children.set(0);
      component.infants.set(0);

      component.value = null as unknown as GuestSelection;

      expect(component.adults()).toBe(2); // Should remain unchanged
      expect(component.children()).toBe(0);
      expect(component.infants()).toBe(0);
    });

    it('should update display text after value input', () => {
      const testValue: GuestSelection = {
        adults: 5,
        children: 0,
        infants: 2,
      };

      component.value = testValue;
      expect(component.summaryText).toBe('5 Adults, 2 Infants');
    });
  });

  describe('Anchored Panel Positioning', () => {
    it('should have panelOffsetLeft, panelWidth, and panelCentered signals', () => {
      expect(component.panelOffsetLeft()).toBe(0);
      expect(component.panelTop()).toBe(0);
      expect(component.panelWidth()).toBe(300);
      expect(component.panelCentered()).toBe(false);
    });

    it('should anchor the panel to the left edge of the trigger on desktop', () => {
      component.toggle();
      fixture.detectChanges();
      expect(component.panelTop()).toBeGreaterThan(0);
      expect(component.panelWidth()).toBeGreaterThanOrEqual(300);
      expect(component.panelOffsetLeft()).toBeGreaterThanOrEqual(0);
    });

    it('should shift left to keep the dropdown inside the viewport', () => {
      const trigger = component.triggerBtn.nativeElement;
      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 120,
        bottom: 168,
        left: 760,
        right: 1080,
        x: 760,
        y: 120,
        toJSON: () => ({}),
      });
      jest.spyOn(component['elementRef'].nativeElement, 'getBoundingClientRect').mockReturnValue({
        width: 320,
        height: 48,
        top: 120,
        bottom: 168,
        left: 760,
        right: 1080,
        x: 760,
        y: 120,
        toJSON: () => ({}),
      } as DOMRect);

      component.toggle();

      expect(component.panelTop()).toBe(56);
      expect(component.panelOffsetLeft()).toBeLessThan(trigger.getBoundingClientRect().left);
      expect(component.panelWidth()).toBe(340);
    });

    it('should center the dropdown on mobile viewports', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 480 });

      component.toggle();

      expect(component.panelCentered()).toBe(true);
      expect(component.panelTop()).toBeGreaterThan(0);
      expect(component.panelOffsetLeft()).toBeGreaterThanOrEqual(0);
      expect(component.panelWidth()).toBe(340);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    });

    it('should update panel position when ResizeObserver fires', () => {
      const spy = jest.spyOn(component as never, 'positionPanel' as never);
      component.ngAfterViewInit();
      component.toggle();
      // ResizeObserver would trigger positionPanel, but we verify the spy
      expect(spy).toHaveBeenCalled();
    });

    it('should align the dropdown to the trigger left edge on desktop', () => {
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
      const trigger = component.triggerBtn.nativeElement;
      jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
        width: 260,
        height: 48,
        top: 80,
        bottom: 128,
        left: 140,
        right: 400,
        x: 140,
        y: 80,
        toJSON: () => ({}),
      });
      jest.spyOn(component['elementRef'].nativeElement, 'getBoundingClientRect').mockReturnValue({
        width: 260,
        height: 48,
        top: 80,
        bottom: 128,
        left: 140,
        right: 400,
        x: 140,
        y: 80,
        toJSON: () => ({}),
      } as DOMRect);

      component.toggle();

      expect(component.panelOffsetLeft()).toBe(0);
      expect(component.panelTop()).toBe(56);

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
    });
    it('should close when clicking outside the component', () => {
      component.open.set(true);
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', {
        value: document.createElement('div'),
      });

      component.onDocumentClick(event);

      expect(component.open()).toBe(false);
    });

    it('should keep the dropdown open when clicking inside the component', () => {
      component.open.set(true);
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', {
        value: component.triggerBtn.nativeElement,
      });

      component.onDocumentClick(event);

      expect(component.open()).toBe(true);
    });
  });

  describe('Keyboard Escape Closes', () => {
    it('should close dropdown on Escape key', () => {
      component.open.set(true);
      component.onEscapeKey();
      expect(component.open()).toBe(false);
    });

    it('should not close if already closed', () => {
      component.open.set(false);
      component.onEscapeKey();
      expect(component.open()).toBe(false);
    });

    it('should emit values before closing on Escape', (done) => {
      component.adults.set(5);
      component.open.set(true);

      component.valueChange.subscribe((value: GuestSelection) => {
        expect(value.adults).toBe(5);
        done();
      });

      component.onEscapeKey();
    });
  });

  describe('Event Emissions', () => {
    it('should emit on increment', (done) => {
      component.valueChange.subscribe(() => {
        done();
      });
      component.increment('adults');
    });

    it('should emit on decrement', (done) => {
      component.adults.set(3);
      let emissionCount = 0;
      component.valueChange.subscribe(() => {
        emissionCount++;
        if (emissionCount === 1) {
          done();
        }
      });

      component.decrement('adults');
    });
  });

  describe('Compact Mode', () => {
    it('should accept compact input', () => {
      component.compact = true;
      expect(component.compact).toBe(true);
    });

    it('should have compact property false by default', () => {
      const freshFixture = TestBed.createComponent(GuestPickerComponent);
      expect(freshFixture.componentInstance.compact).toBe(false);
    });
  });

  describe('Total Guests Calculation', () => {
    it('should calculate total guests as adults + children', () => {
      component.adults.set(3);
      component.children.set(2);
      component.infants.set(1);
      expect(component.totalGuests).toBe(5); // Infants not counted in total
    });

    it('should return 2 for default state', () => {
      expect(component.totalGuests).toBe(2);
    });
  });

  describe('Cleanup on Destroy', () => {
    it('should disconnect ResizeObserver on destroy', () => {
      const disconnect = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (component as any)['resizeObserver'] = { disconnect } as { disconnect: () => void };
      component.ngOnDestroy();
      expect(disconnect).toHaveBeenCalled();
    });

    it('should destroy cleanly without scroll listener cleanup', () => {
      component.toggle();
      component.ngOnDestroy();
      expect(component.open()).toBe(true);
    });
  });
});
