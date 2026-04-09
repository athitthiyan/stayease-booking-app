import { TestBed } from '@angular/core/testing';
import { BookingSearchStore } from './booking-search.store';

describe('BookingSearchStore', () => {
  let store: BookingSearchStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingSearchStore],
    });
    store = TestBed.inject(BookingSearchStore);

    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    jest.restoreAllMocks();
  });

  describe('Default state', () => {
    it('should initialize with correct default values', () => {
      const state = store.state();
      expect(state.adults).toBe(2);
      expect(state.children).toBe(0);
      expect(state.infants).toBe(0);
      expect(state.destination).toBe('');
      expect(state.checkIn).toBe('');
      expect(state.checkOut).toBe('');
      expect(state.rooms).toBe(1);
      expect(state.promoCode).toBe('');
    });

    it('should have correct default values via computed signals', () => {
      expect(store.adults()).toBe(2);
      expect(store.children()).toBe(0);
      expect(store.infants()).toBe(0);
      expect(store.destination()).toBe('');
      expect(store.checkIn()).toBe('');
      expect(store.checkOut()).toBe('');
    });
  });

  describe('updateDestination', () => {
    it('should update destination field', () => {
      store.updateDestination('Paris');
      expect(store.destination()).toBe('Paris');
    });

    it('should update destination and preserve other fields', () => {
      store.updateGuests(3, 1, 0);
      store.updateDestination('London');
      expect(store.destination()).toBe('London');
      expect(store.adults()).toBe(3);
      expect(store.children()).toBe(1);
    });

    it('should allow empty destination', () => {
      store.updateDestination('Tokyo');
      store.updateDestination('');
      expect(store.destination()).toBe('');
    });
  });

  describe('updateDates', () => {
    it('should set check-in and check-out dates', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.checkOut()).toBe('2025-06-05');
    });

    it('should update both dates simultaneously', () => {
      store.updateDates('2025-07-15', '2025-07-20');
      expect(store.nights()).toBe(5);
    });

    it('should allow clearing both dates', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      store.updateDates('', '');
      expect(store.checkIn()).toBe('');
      expect(store.checkOut()).toBe('');
    });
  });

  describe('updateCheckIn', () => {
    it('should update check-in date', () => {
      store.updateCheckIn('2025-06-01');
      expect(store.checkIn()).toBe('2025-06-01');
    });

    it('should auto-advance check-out when check-in >= check-out', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      store.updateCheckIn('2025-06-10');
      expect(store.checkIn()).toBe('2025-06-10');
      expect(store.checkOut()).toBe('2025-06-11');
    });

    it('should auto-advance check-out when new check-in equals old check-out', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      store.updateCheckIn('2025-06-05');
      expect(store.checkOut()).toBe('2025-06-06');
    });

    it('should not modify check-out when new check-in is before existing check-out', () => {
      store.updateDates('2025-06-10', '2025-06-15');
      store.updateCheckIn('2025-06-05');
      expect(store.checkOut()).toBe('2025-06-15');
    });

    it('should advance check-out by 1 day when no check-out exists', () => {
      store.updateCheckIn('2025-06-15');
      expect(store.checkOut()).toBe('2025-06-16');
    });

    it('should preserve check-out when new check-in is before existing check-out', () => {
      store.updateDates('2025-06-10', '2025-06-20');
      store.updateCheckIn('2025-06-08');
      expect(store.checkOut()).toBe('2025-06-20');
    });
  });

  describe('updateCheckOut', () => {
    it('should update check-out date independently', () => {
      store.updateCheckOut('2025-06-10');
      expect(store.checkOut()).toBe('2025-06-10');
    });

    it('should not affect check-in when updating check-out', () => {
      store.updateCheckIn('2025-06-01');
      store.updateCheckOut('2025-06-10');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.checkOut()).toBe('2025-06-10');
    });

    it('should allow setting check-out to same date as check-in', () => {
      store.updateDates('2025-06-05', '2025-06-10');
      store.updateCheckOut('2025-06-05');
      expect(store.checkOut()).toBe('2025-06-05');
    });
  });

  describe('updateGuests', () => {
    it('should update guests with valid values', () => {
      store.updateGuests(4, 2, 1);
      expect(store.adults()).toBe(4);
      expect(store.children()).toBe(2);
      expect(store.infants()).toBe(1);
    });

    it('should enforce adults >= 1', () => {
      store.updateGuests(0, 2, 0);
      expect(store.adults()).toBe(1);
    });

    it('should enforce children >= 0', () => {
      store.updateGuests(2, -1, 0);
      expect(store.children()).toBe(0);
    });

    it('should enforce infants <= adults', () => {
      store.updateGuests(2, 0, 5);
      expect(store.infants()).toBe(2);
    });

    it('should enforce all constraints simultaneously', () => {
      store.updateGuests(-5, -3, 10);
      expect(store.adults()).toBe(1);
      expect(store.children()).toBe(0);
      expect(store.infants()).toBe(1);
    });

    it('should allow infants = adults', () => {
      store.updateGuests(3, 1, 3);
      expect(store.infants()).toBe(3);
    });

    it('should cap infants when less than adults', () => {
      store.updateGuests(5, 2, 8);
      expect(store.infants()).toBe(5);
    });
  });

  describe('nights computed signal', () => {
    it('should return 0 when dates are empty', () => {
      expect(store.nights()).toBe(0);
    });

    it('should calculate 0 when check-in and check-out are the same', () => {
      store.updateDates('2025-06-05', '2025-06-05');
      expect(store.nights()).toBe(0);
    });

    it('should calculate correct night count for valid date range', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.nights()).toBe(4);
    });

    it('should calculate 1 night for consecutive dates', () => {
      store.updateDates('2025-06-15', '2025-06-16');
      expect(store.nights()).toBe(1);
    });

    it('should handle multi-day ranges', () => {
      store.updateDates('2025-01-01', '2025-01-11');
      expect(store.nights()).toBe(10);
    });

    it('should return 0 when only check-in is set', () => {
      store.updateCheckIn('2025-06-05');
      store.updateCheckOut('');
      expect(store.nights()).toBe(0);
    });

    it('should return 0 when only check-out is set', () => {
      store.updateCheckOut('2025-06-05');
      store.updateCheckIn('');
      expect(store.nights()).toBe(0);
    });
  });

  describe('isValid computed signal', () => {
    it('should be false when destination is empty', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.isValid()).toBe(false);
    });

    it('should be false when check-in is empty', () => {
      store.updateDestination('Paris');
      store.updateCheckOut('2025-06-05');
      expect(store.isValid()).toBe(false);
    });

    it('should be false when check-out is empty', () => {
      store.updateDestination('Paris');
      store.updateDates('2025-06-01', '');
      expect(store.isValid()).toBe(false);
    });

    it('should be false when nights is 0', () => {
      store.updateDestination('Paris');
      store.updateDates('2025-06-05', '2025-06-05');
      expect(store.isValid()).toBe(false);
    });

    it('should be true when all required fields are set and nights > 0', () => {
      store.updateDestination('Paris');
      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.isValid()).toBe(true);
    });

    it('should become invalid when destination is cleared', () => {
      store.updateDestination('Paris');
      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.isValid()).toBe(true);
      store.updateDestination('');
      expect(store.isValid()).toBe(false);
    });
  });

  describe('validationError computed signal', () => {
    it('should return empty string for valid dates', () => {
      store.updateDates('2027-06-10', '2027-06-15');
      expect(store.validationError()).toBe('');
    });

    it('should return empty string when dates are not set', () => {
      expect(store.validationError()).toBe('');
    });

    it('should return error for past check-in date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      store.updateDates(yesterdayStr, tomorrowStr);
      expect(store.validationError()).toBe('Check-in date cannot be in the past');
    });

    it('should return error for same-day check-out (check-out <= check-in)', () => {
      store.updateDates('2027-06-05', '2027-06-05');
      expect(store.validationError()).toBe('Check-out must be after check-in');
    });

    it('should return error when check-out is before check-in', () => {
      store.updateDates('2027-06-10', '2027-06-05');
      expect(store.validationError()).toBe('Check-out must be after check-in');
    });

    it('should be valid for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
      const checkOut = new Date(futureDate);
      checkOut.setDate(checkOut.getDate() + 5);
      const checkOutStr = `${checkOut.getFullYear()}-${String(checkOut.getMonth() + 1).padStart(2, '0')}-${String(checkOut.getDate()).padStart(2, '0')}`;

      store.updateDates(futureDateStr, checkOutStr);
      expect(store.validationError()).toBe('');
    });
  });

  describe('dateRangeText computed signal', () => {
    it('should return empty string when dates are not set', () => {
      expect(store.dateRangeText()).toBe('');
    });

    it('should return empty string when only check-in is set', () => {
      store.updateDates('2025-06-15', '');
      expect(store.dateRangeText()).toBe('');
    });

    it('should return correctly formatted text for valid dates', () => {
      store.updateDates('2025-04-09', '2025-04-10');
      expect(store.dateRangeText()).toBe('Apr 9 → Apr 10 • 1 night');
    });

    it('should use plural "nights" for multiple nights', () => {
      store.updateDates('2025-04-09', '2025-04-12');
      expect(store.dateRangeText()).toBe('Apr 9 → Apr 12 • 3 nights');
    });

    it('should format dates across months correctly', () => {
      store.updateDates('2025-05-28', '2025-06-02');
      expect(store.dateRangeText()).toContain('May 28');
      expect(store.dateRangeText()).toContain('Jun 2');
      expect(store.dateRangeText()).toContain('5 nights');
    });

    it('should format dates across years correctly', () => {
      store.updateDates('2025-12-30', '2026-01-02');
      expect(store.dateRangeText()).toContain('Dec 30');
      expect(store.dateRangeText()).toContain('Jan 2');
    });
  });

  describe('guestSummary computed signal', () => {
    it('should return "2 Adults" for default state', () => {
      expect(store.guestSummary()).toBe('2 Adults');
    });

    it('should return "1 Adult" for single adult', () => {
      store.updateGuests(1, 0, 0);
      expect(store.guestSummary()).toBe('1 Adult');
    });

    it('should include children in summary', () => {
      store.updateGuests(2, 1, 0);
      expect(store.guestSummary()).toBe('2 Adults, 1 Child');
    });

    it('should use plural "Children" for multiple children', () => {
      store.updateGuests(2, 2, 0);
      expect(store.guestSummary()).toBe('2 Adults, 2 Children');
    });

    it('should include infants in summary', () => {
      store.updateGuests(2, 0, 1);
      expect(store.guestSummary()).toBe('2 Adults, 1 Infant');
    });

    it('should use plural "Infants" for multiple infants', () => {
      store.updateGuests(2, 0, 2);
      expect(store.guestSummary()).toBe('2 Adults, 2 Infants');
    });

    it('should include all guest types', () => {
      store.updateGuests(3, 2, 1);
      expect(store.guestSummary()).toBe('3 Adults, 2 Children, 1 Infant');
    });

    it('should handle all guest types with plurals', () => {
      store.updateGuests(4, 3, 2);
      expect(store.guestSummary()).toBe('4 Adults, 3 Children, 2 Infants');
    });
  });

  describe('sessionStorage persistence', () => {
    it('should save state to sessionStorage on initialization', (done) => {
      const newStore = TestBed.runInInjectionContext(() => new BookingSearchStore());
      newStore.updateDestination('Barcelona');
      newStore.updateDates('2025-06-01', '2025-06-05');

      // Allow effect to run asynchronously
      setTimeout(() => {
        const stored = sessionStorage.getItem('sv_booking_search_state');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored!);
        expect(parsed.destination).toBe('Barcelona');
        expect(parsed.checkIn).toBe('2025-06-01');
        expect(parsed.checkOut).toBe('2025-06-05');
        done();
      }, 50);
    });

    it('should restore state from sessionStorage', () => {
      const initialState = {
        destination: 'Amsterdam',
        checkIn: '2025-07-10',
        checkOut: '2025-07-15',
        adults: 3,
        children: 1,
        infants: 0,
        rooms: 1,
        promoCode: 'SUMMER20',
      };
      sessionStorage.setItem('sv_booking_search_state', JSON.stringify(initialState));

      const newStore = TestBed.runInInjectionContext(() => new BookingSearchStore());
      expect(newStore.destination()).toBe('Amsterdam');
      expect(newStore.checkIn()).toBe('2025-07-10');
      expect(newStore.checkOut()).toBe('2025-07-15');
      expect(newStore.adults()).toBe(3);
      expect(newStore.children()).toBe(1);
    });

    it('should merge restored state with defaults', () => {
      const partialState = {
        destination: 'Rome',
        checkIn: '2025-08-01',
      };
      sessionStorage.setItem('sv_booking_search_state', JSON.stringify(partialState));

      const newStore = TestBed.runInInjectionContext(() => new BookingSearchStore());
      expect(newStore.destination()).toBe('Rome');
      expect(newStore.checkIn()).toBe('2025-08-01');
      expect(newStore.adults()).toBe(2); // default
      expect(newStore.children()).toBe(0); // default
    });

    it('should use defaults when sessionStorage is corrupted', () => {
      sessionStorage.setItem('sv_booking_search_state', '{invalid json');

      const newStore = TestBed.runInInjectionContext(() => new BookingSearchStore());
      expect(newStore.destination()).toBe('');
      expect(newStore.adults()).toBe(2);
    });

    it('should persist updates to sessionStorage', (done) => {
      store.updateDestination('Berlin');
      // Allow effect to run
      setTimeout(() => {
        const stored = sessionStorage.getItem('sv_booking_search_state');
        const parsed = JSON.parse(stored!);
        expect(parsed.destination).toBe('Berlin');
        done();
      }, 10);
    });

    it('should handle sessionStorage.setItem errors gracefully', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };

      expect(() => {
        store.updateDestination('Vienna');
      }).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe('toQueryParams', () => {
    it('should generate empty params for default state', () => {
      const params = store.toQueryParams();
      expect(params['destination']).toBeUndefined();
      expect(params['checkIn']).toBeUndefined();
      expect(params['checkOut']).toBeUndefined();
    });

    it('should include destination in params', () => {
      store.updateDestination('Paris');
      const params = store.toQueryParams();
      expect(params['destination']).toBe('Paris');
      expect(params['city']).toBe('Paris'); // legacy support
    });

    it('should include dates in params with snake_case keys', () => {
      store.updateDates('2025-06-01', '2025-06-05');
      const params = store.toQueryParams();
      expect(params['check_in']).toBe('2025-06-01');
      expect(params['check_out']).toBe('2025-06-05');
    });

    it('should include guest counts as strings', () => {
      store.updateGuests(3, 1, 1);
      const params = store.toQueryParams();
      expect(params['adults']).toBe('3');
      expect(params['children']).toBe('1');
      expect(params['infants']).toBe('1');
    });

    it('should not include 0 values for optional fields', () => {
      store.patchState({ minPrice: undefined, maxPrice: undefined });
      const params = store.toQueryParams();
      expect(params['min_price']).toBeUndefined();
      expect(params['max_price']).toBeUndefined();
    });

    it('should include price filters', () => {
      store.updateFilters({ minPrice: 50, maxPrice: 500 });
      const params = store.toQueryParams();
      expect(params['min_price']).toBe('50');
      expect(params['max_price']).toBe('500');
    });

    it('should include rating filter', () => {
      store.updateFilters({ minRating: 4.5 });
      const params = store.toQueryParams();
      expect(params['min_rating']).toBe('4.5');
    });

    it('should include amenities', () => {
      store.updateFilters({ amenities: 'wifi,pool' });
      const params = store.toQueryParams();
      expect(params['amenities']).toBe('wifi,pool');
    });

    it('should include room type', () => {
      store.updateFilters({ roomType: 'apartment' });
      const params = store.toQueryParams();
      expect(params['room_type']).toBe('apartment');
    });

    it('should include sort by', () => {
      store.updateFilters({ sortBy: 'price-asc' });
      const params = store.toQueryParams();
      expect(params['sort_by']).toBe('price-asc');
    });

    it('should include promo code', () => {
      store.patchState({ promoCode: 'SAVE20' });
      const params = store.toQueryParams();
      expect(params['promo']).toBe('SAVE20');
    });

    it('should include all fields together', () => {
      store.updateDestination('London');
      store.updateDates('2025-07-01', '2025-07-08');
      store.updateGuests(2, 1, 0);
      store.updateFilters({
        minPrice: 100,
        maxPrice: 300,
        minRating: 4.0,
        amenities: 'wifi',
        roomType: 'studio',
        sortBy: 'rating-desc',
      });
      store.patchState({ promoCode: 'SUMMER' });

      const params = store.toQueryParams();
      expect(params['destination']).toBe('London');
      expect(params['city']).toBe('London');
      expect(params['check_in']).toBe('2025-07-01');
      expect(params['check_out']).toBe('2025-07-08');
      expect(params['adults']).toBe('2');
      expect(params['children']).toBe('1');
      expect(params['min_price']).toBe('100');
      expect(params['max_price']).toBe('300');
      expect(params['min_rating']).toBe('4');
      expect(params['amenities']).toBe('wifi');
      expect(params['room_type']).toBe('studio');
      expect(params['sort_by']).toBe('rating-desc');
      expect(params['promo']).toBe('SUMMER');
    });
  });

  describe('fromQueryParams', () => {
    it('should parse destination from destination param', () => {
      store.fromQueryParams({ destination: 'Milan' });
      expect(store.destination()).toBe('Milan');
    });

    it('should parse destination from legacy city param', () => {
      store.fromQueryParams({ city: 'Venice' });
      expect(store.destination()).toBe('Venice');
    });

    it('should prefer destination over city param', () => {
      store.fromQueryParams({ destination: 'Milan', city: 'Venice' });
      expect(store.destination()).toBe('Milan');
    });

    it('should preserve existing destination if params empty', () => {
      store.updateDestination('Paris');
      store.fromQueryParams({});
      expect(store.destination()).toBe('Paris');
    });

    it('should parse date params', () => {
      store.fromQueryParams({
        check_in: '2025-08-01',
        check_out: '2025-08-10',
      });
      expect(store.checkIn()).toBe('2025-08-01');
      expect(store.checkOut()).toBe('2025-08-10');
    });

    it('should parse guest counts as numbers', () => {
      store.fromQueryParams({
        adults: '3',
        children: '2',
        infants: '1',
      });
      expect(store.adults()).toBe(3);
      expect(store.children()).toBe(2);
      expect(store.infants()).toBe(1);
    });

    it('should parse price filters', () => {
      store.fromQueryParams({
        min_price: '75',
        max_price: '400',
      });
      expect(store.state().minPrice).toBe(75);
      expect(store.state().maxPrice).toBe(400);
    });

    it('should parse rating filter', () => {
      store.fromQueryParams({ min_rating: '4.5' });
      expect(store.state().minRating).toBe(4.5);
    });

    it('should parse amenities', () => {
      store.fromQueryParams({ amenities: 'pool,gym,wifi' });
      expect(store.state().amenities).toBe('pool,gym,wifi');
    });

    it('should parse room type', () => {
      store.fromQueryParams({ room_type: 'villa' });
      expect(store.state().roomType).toBe('villa');
    });

    it('should parse sort by', () => {
      store.fromQueryParams({ sort_by: 'price-desc' });
      expect(store.state().sortBy).toBe('price-desc');
    });

    it('should parse promo code', () => {
      store.fromQueryParams({ promo: 'SPRING50' });
      expect(store.state().promoCode).toBe('SPRING50');
    });

    it('should parse all params together', () => {
      store.fromQueryParams({
        destination: 'Barcelona',
        check_in: '2025-09-01',
        check_out: '2025-09-07',
        adults: '4',
        children: '1',
        infants: '1',
        min_price: '150',
        max_price: '600',
        min_rating: '4.5',
        amenities: 'gym,restaurant',
        room_type: 'penthouse',
        sort_by: 'popularity',
        promo: 'FALL20',
      });

      expect(store.destination()).toBe('Barcelona');
      expect(store.checkIn()).toBe('2025-09-01');
      expect(store.checkOut()).toBe('2025-09-07');
      expect(store.adults()).toBe(4);
      expect(store.children()).toBe(1);
      expect(store.infants()).toBe(1);
      expect(store.state().minPrice).toBe(150);
      expect(store.state().maxPrice).toBe(600);
      expect(store.state().minRating).toBe(4.5);
      expect(store.state().amenities).toBe('gym,restaurant');
      expect(store.state().roomType).toBe('penthouse');
      expect(store.state().sortBy).toBe('popularity');
      expect(store.state().promoCode).toBe('FALL20');
    });

    it('should preserve existing values when params are missing', () => {
      store.updateDestination('Tokyo');
      store.updateDates('2025-10-01', '2025-10-05');
      store.updateGuests(3, 0, 0);

      store.fromQueryParams({ adults: '2' });

      expect(store.destination()).toBe('Tokyo');
      expect(store.checkIn()).toBe('2025-10-01');
      expect(store.checkOut()).toBe('2025-10-05');
      expect(store.adults()).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear state to defaults', () => {
      store.updateDestination('London');
      store.updateDates('2025-06-01', '2025-06-10');
      store.updateGuests(5, 2, 1);
      store.patchState({ promoCode: 'PROMO' });

      store.reset();

      expect(store.destination()).toBe('');
      expect(store.checkIn()).toBe('');
      expect(store.checkOut()).toBe('');
      expect(store.adults()).toBe(2);
      expect(store.children()).toBe(0);
      expect(store.infants()).toBe(0);
      expect(store.state().promoCode).toBe('');
    });

    it('should remove sessionStorage key', () => {
      store.updateDestination('Dublin');
      store.updateDates('2025-07-01', '2025-07-05');

      store.reset();

      expect(sessionStorage.getItem('sv_booking_search_state')).toBeNull();
    });

    it('should reset rooms to default', () => {
      store.patchState({ rooms: 3 });
      store.reset();
      expect(store.state().rooms).toBe(1);
    });

    it('should clear filters on reset', () => {
      store.updateFilters({
        minPrice: 100,
        maxPrice: 500,
        minRating: 4.0,
        amenities: 'pool',
      });

      store.reset();

      expect(store.state().minPrice).toBeUndefined();
      expect(store.state().maxPrice).toBeUndefined();
      expect(store.state().minRating).toBeUndefined();
      expect(store.state().amenities).toBeUndefined();
    });
  });

  describe('Redirect intent', () => {
    it('should set redirect intent', () => {
      store.setRedirectIntent('/checkout/payment');
      expect(sessionStorage.getItem('sv_redirect_after_login')).toBe(
        '/checkout/payment'
      );
    });

    it('should get and clear redirect intent', () => {
      store.setRedirectIntent('/search-results');
      const url = store.getAndClearRedirectIntent();
      expect(url).toBe('/search-results');
      expect(sessionStorage.getItem('sv_redirect_after_login')).toBeNull();
    });

    it('should return null when no redirect is set', () => {
      const url = store.getAndClearRedirectIntent();
      expect(url).toBeNull();
    });

    it('should clear redirect only when getting it', () => {
      store.setRedirectIntent('/my-bookings');
      store.getAndClearRedirectIntent();
      const secondGet = store.getAndClearRedirectIntent();
      expect(secondGet).toBeNull();
    });

    it('should handle multiple redirect updates', () => {
      store.setRedirectIntent('/page1');
      store.setRedirectIntent('/page2');
      const url = store.getAndClearRedirectIntent();
      expect(url).toBe('/page2');
    });
  });

  describe('Pending checkout', () => {
    it('should save pending checkout draft', () => {
      const draft = { roomId: '123', guestName: 'John Doe' };
      store.savePendingCheckout(draft);

      const stored = sessionStorage.getItem('sv_pending_checkout_draft');
      expect(JSON.parse(stored!)).toEqual(draft);
    });

    it('should get pending checkout', () => {
      const draft = { roomId: '456', checkInDate: '2025-08-01' };
      store.savePendingCheckout(draft);

      const retrieved = store.getPendingCheckout();
      expect(retrieved).toEqual(draft);
    });

    it('should return null when no pending checkout exists', () => {
      const retrieved = store.getPendingCheckout();
      expect(retrieved).toBeNull();
    });

    it('should clear pending checkout', () => {
      const draft = { roomId: '789' };
      store.savePendingCheckout(draft);
      expect(store.getPendingCheckout()).not.toBeNull();

      store.clearPendingCheckout();
      expect(store.getPendingCheckout()).toBeNull();
      expect(sessionStorage.getItem('sv_pending_checkout_draft')).toBeNull();
    });

    it('should handle complex draft objects', () => {
      const draft = {
        roomId: '123',
        guestName: 'Jane Doe',
        email: 'jane@example.com',
        specialRequests: 'Late checkout',
        paymentInfo: { method: 'card', lastFour: '4242' },
      };
      store.savePendingCheckout(draft);

      const retrieved = store.getPendingCheckout();
      expect(retrieved).toEqual(draft);
    });

    it('should overwrite previous pending checkout', () => {
      store.savePendingCheckout({ data: 'first' });
      store.savePendingCheckout({ data: 'second' });

      const retrieved = store.getPendingCheckout();
      expect(retrieved).toEqual({ data: 'second' });
    });
  });

  describe('hasRecentSearch', () => {
    it('should return false when no destination and check-in', () => {
      expect(store.hasRecentSearch()).toBe(false);
    });

    it('should return false when only destination is set', () => {
      store.updateDestination('Paris');
      expect(store.hasRecentSearch()).toBe(false);
    });

    it('should return false when only check-in is set', () => {
      store.updateCheckIn('2025-06-01');
      expect(store.hasRecentSearch()).toBe(false);
    });

    it('should return true when destination and check-in are set', () => {
      store.updateDestination('Berlin');
      store.updateCheckIn('2025-07-15');
      expect(store.hasRecentSearch()).toBe(true);
    });

    it('should return true even without check-out', () => {
      store.updateDestination('Amsterdam');
      store.updateCheckIn('2025-08-01');
      store.updateCheckOut('');
      expect(store.hasRecentSearch()).toBe(true);
    });

    it('should return false when destination is cleared', () => {
      store.updateDestination('Rome');
      store.updateCheckIn('2025-09-01');
      expect(store.hasRecentSearch()).toBe(true);

      store.updateDestination('');
      expect(store.hasRecentSearch()).toBe(false);
    });

    it('should return false when check-in is cleared', () => {
      store.updateDestination('Venice');
      store.updateCheckIn('2025-10-01');
      expect(store.hasRecentSearch()).toBe(true);

      store.updateCheckIn('');
      expect(store.hasRecentSearch()).toBe(false);
    });
  });

  describe('patchState', () => {
    it('should merge partial state updates', () => {
      store.updateDestination('Paris');
      store.updateGuests(2, 0, 0);

      store.patchState({ checkIn: '2025-06-01', promoCode: 'SAVE10' });

      expect(store.destination()).toBe('Paris');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.adults()).toBe(2);
      expect(store.state().promoCode).toBe('SAVE10');
    });

    it('should update single field without affecting others', () => {
      store.updateDestination('London');
      store.updateDates('2025-06-01', '2025-06-10');
      store.updateGuests(3, 1, 0);

      store.patchState({ roomType: 'suite' });

      expect(store.destination()).toBe('London');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.checkOut()).toBe('2025-06-10');
      expect(store.adults()).toBe(3);
      expect(store.state().roomType).toBe('suite');
    });

    it('should allow clearing fields with undefined', () => {
      store.patchState({ promoCode: 'PROMO', roomType: 'villa' });
      expect(store.state().promoCode).toBe('PROMO');
      expect(store.state().roomType).toBe('villa');

      store.patchState({ promoCode: '' });
      expect(store.state().promoCode).toBe('');
    });

    it('should update multiple fields at once', () => {
      store.patchState({
        destination: 'Tokyo',
        checkIn: '2025-09-01',
        checkOut: '2025-09-10',
        minPrice: 200,
        maxPrice: 800,
      });

      expect(store.destination()).toBe('Tokyo');
      expect(store.checkIn()).toBe('2025-09-01');
      expect(store.checkOut()).toBe('2025-09-10');
      expect(store.state().minPrice).toBe(200);
      expect(store.state().maxPrice).toBe(800);
    });

    it('should preserve defaults for unspecified fields', () => {
      store.patchState({ destination: 'Vienna' });

      expect(store.destination()).toBe('Vienna');
      expect(store.adults()).toBe(2); // default preserved
      expect(store.children()).toBe(0); // default preserved
      expect(store.state().rooms).toBe(1); // default rooms value
    });

    it('should work with computed signals after patch', () => {
      store.patchState({
        destination: 'Madrid',
        checkIn: '2025-10-01',
        checkOut: '2025-10-08',
      });

      expect(store.isValid()).toBe(true);
      expect(store.nights()).toBe(7);
      expect(store.hasRecentSearch()).toBe(true);
    });
  });

  describe('totalGuests computed signal', () => {
    it('should sum adults and children', () => {
      store.updateGuests(3, 2, 1);
      expect(store.totalGuests()).toBe(5);
    });

    it('should not include infants in total', () => {
      store.updateGuests(2, 1, 3);
      expect(store.totalGuests()).toBe(3);
    });

    it('should return only adults when no children', () => {
      store.updateGuests(4, 0, 0);
      expect(store.totalGuests()).toBe(4);
    });

    it('should return 2 for default state', () => {
      expect(store.totalGuests()).toBe(2);
    });
  });

  describe('updateFilters', () => {
    it('should update price filters', () => {
      store.updateFilters({ minPrice: 100, maxPrice: 500 });
      expect(store.state().minPrice).toBe(100);
      expect(store.state().maxPrice).toBe(500);
    });

    it('should preserve other state when updating filters', () => {
      store.updateDestination('Barcelona');
      store.updateDates('2025-06-01', '2025-06-05');

      store.updateFilters({ minPrice: 150 });

      expect(store.destination()).toBe('Barcelona');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.state().minPrice).toBe(150);
    });

    it('should update multiple filters at once', () => {
      store.updateFilters({
        minPrice: 200,
        maxPrice: 600,
        minRating: 4.5,
        amenities: 'wifi,pool',
        roomType: 'apartment',
        sortBy: 'price-asc',
      });

      expect(store.state().minPrice).toBe(200);
      expect(store.state().maxPrice).toBe(600);
      expect(store.state().minRating).toBe(4.5);
      expect(store.state().amenities).toBe('wifi,pool');
      expect(store.state().roomType).toBe('apartment');
      expect(store.state().sortBy).toBe('price-asc');
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle rapid consecutive updates', () => {
      store.updateDestination('Paris');
      store.updateCheckIn('2025-06-01');
      store.updateCheckOut('2025-06-05');
      store.updateGuests(2, 1, 0);
      store.patchState({ promoCode: 'PROMO' });

      expect(store.destination()).toBe('Paris');
      expect(store.checkIn()).toBe('2025-06-01');
      expect(store.checkOut()).toBe('2025-06-05');
      expect(store.isValid()).toBe(true);
    });

    it('should maintain validity through state transitions', () => {
      store.updateDestination('London');
      expect(store.isValid()).toBe(false);

      store.updateDates('2025-06-01', '2025-06-05');
      expect(store.isValid()).toBe(true);

      store.updateDestination('');
      expect(store.isValid()).toBe(false);

      store.updateDestination('London');
      expect(store.isValid()).toBe(true);
    });

    it('should correctly handle check-in update with existing valid dates', () => {
      store.updateDates('2025-06-01', '2025-06-10');
      const initialCheckOut = store.checkOut();

      store.updateCheckIn('2025-06-05');
      expect(store.checkIn()).toBe('2025-06-05');
      expect(store.checkOut()).toBe(initialCheckOut);
    });

    it('should generate correct query params after complex state changes', () => {
      store.updateDestination('Tokyo');
      store.updateDates('2025-08-01', '2025-08-10');
      store.updateGuests(3, 2, 1);
      store.updateFilters({ minPrice: 150, maxPrice: 400 });

      const params = store.toQueryParams();
      const newStore = TestBed.runInInjectionContext(() => new BookingSearchStore());
      newStore.fromQueryParams(params);

      expect(newStore.destination()).toBe('Tokyo');
      expect(newStore.checkIn()).toBe('2025-08-01');
      expect(newStore.checkOut()).toBe('2025-08-10');
      expect(newStore.adults()).toBe(3);
      expect(newStore.children()).toBe(2);
      expect(newStore.infants()).toBe(1);
      expect(newStore.state().minPrice).toBe(150);
      expect(newStore.state().maxPrice).toBe(400);
    });
  });
});
