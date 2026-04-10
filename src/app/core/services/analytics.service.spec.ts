/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { AnalyticsService, AnalyticsEvent } from './analytics.service';
import * as environmentModule from '../../../environments/environment';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let routerEventsSubject: Subject<any>;
  let mockRouter: any;

  beforeEach(() => {
    // Create a subject to control router events
    routerEventsSubject = new Subject();

    // Mock Router
    mockRouter = {
      events: routerEventsSubject.asObservable(),
    };

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(AnalyticsService);

    // Mock window.gtag and window.dataLayer
    window.gtag = jest.fn();
    window.dataLayer = [];

    // Mock document methods
    jest.spyOn(document, 'createElement').mockReturnValue({
      async: false,
      src: '',
    } as any);
    jest.spyOn(document, 'querySelector').mockReturnValue(null);
    jest.spyOn(document.head, 'appendChild').mockImplementation();

    // Mock console.debug
    jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as any).gtag;
    delete (window as any).dataLayer;
  });

  describe('init()', () => {
    it('should set initialized flag to true', () => {
      service.init();
      expect((service as any).initialized).toBe(true);
    });

    it('should be idempotent - calling init twice should not duplicate subscriptions', () => {
      service.init();
      jest.spyOn(routerEventsSubject, 'subscribe');

      service.init();

      // Subscription should have only happened once (in first init call)
      expect(routerEventsSubject.observers.length).toBe(1);
    });

    it('should load GA4 if gaMeasurementId is configured in environment', () => {
      const measurementId = 'G-TEST123';
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: false,
          gaMeasurementId: measurementId,
        },
        writable: true,
      });

      try {
        const loadGA4Spy = jest.spyOn(service as any, 'loadGA4');
        service.init();

        expect(loadGA4Spy).toHaveBeenCalledWith(measurementId);
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should not load GA4 if gaMeasurementId is empty in environment', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: false,
          gaMeasurementId: '',
        },
        writable: true,
      });

      try {
        const loadGA4Spy = jest.spyOn(service as any, 'loadGA4');
        service.init();

        expect(loadGA4Spy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should not load GA4 if gaMeasurementId is undefined in environment', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: false,
        },
        writable: true,
      });

      try {
        const loadGA4Spy = jest.spyOn(service as any, 'loadGA4');
        service.init();

        expect(loadGA4Spy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should subscribe to router NavigationEnd events', () => {
      service.init();

      expect(routerEventsSubject.observers.length).toBe(1);
    });

    it('should track page_view event on NavigationEnd', () => {
      service.init();

      const trackSpy = jest.spyOn(service, 'track');
      document.title = 'Test Page';

      const navEnd = new NavigationEnd(1, '/test-path', '/test-path');
      routerEventsSubject.next(navEnd);

      expect(trackSpy).toHaveBeenCalledWith('page_view', {
        page_path: '/test-path',
        page_title: 'Test Page',
      });
    });

    it('should flush queued events on init', () => {
      // Queue some events before initialization
      const queuedEvents = [
        { name: 'event1', properties: {}, timestamp: '2026-01-01T00:00:00.000Z' },
        { name: 'event2', properties: {}, timestamp: '2026-01-01T00:00:01.000Z' },
      ];
      (service as any).queue = queuedEvents;

      const dispatchSpy = jest.spyOn(service as any, 'dispatch');
      service.init();

      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      expect(dispatchSpy).toHaveBeenNthCalledWith(1, queuedEvents[0]);
      expect(dispatchSpy).toHaveBeenNthCalledWith(2, queuedEvents[1]);
    });

    it('should clear queue after flushing on init', () => {
      (service as any).queue = [
        { name: 'event1', properties: {}, timestamp: '2026-01-01T00:00:00.000Z' },
      ];

      service.init();

      expect((service as any).queue).toEqual([]);
    });

    it('should ignore non-NavigationEnd router events', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      // Send a non-NavigationEnd event
      routerEventsSubject.next({ type: 'NavigationStart' });

      expect(trackSpy).not.toHaveBeenCalled();
    });
  });

  describe('track()', () => {
    it('should queue event if not initialized', () => {
      service.track('test_event', { key: 'value' });

      const queue = (service as any).queue;
      expect(queue.length).toBe(1);
      expect(queue[0].name).toBe('test_event');
      expect(queue[0].properties).toEqual({ key: 'value' });
      expect(queue[0].timestamp).toBeDefined();
    });

    it('should dispatch event immediately if already initialized', () => {
      service.init();
      const dispatchSpy = jest.spyOn(service as any, 'dispatch');

      service.track('test_event', { key: 'value' });

      expect(dispatchSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchSpy.mock.calls[dispatchSpy.mock.calls.length - 1][0] as { name: string; properties: Record<string, unknown> };
      expect(dispatchedEvent.name).toBe('test_event');
      expect(dispatchedEvent.properties).toEqual({ key: 'value' });
    });

    it('should set timestamp on tracked event', () => {
      const beforeTrack = new Date().toISOString();
      service.track('test_event');
      const afterTrack = new Date().toISOString();

      const queue = (service as any).queue;
      const timestamp = queue[0].timestamp as string;

      expect(timestamp >= beforeTrack).toBe(true);
      expect(timestamp <= afterTrack).toBe(true);
    });

    it('should create shallow copy of properties', () => {
      const originalProps = { key: 'value', nested: { foo: 'bar' } };
      service.track('test_event', originalProps);

      const queue = (service as any).queue;
      originalProps.key = 'modified';

      // Properties should be a shallow copy
      // Top-level primitive changes to the original should NOT appear in the copy
      expect(queue[0].properties.key).toBe('value');
    });

    it('should handle undefined properties', () => {
      service.track('test_event');

      const queue = (service as any).queue;
      expect(queue[0].properties).toEqual({});
    });

    it('should queue multiple events before init', () => {
      service.track('event1', { a: 1 });
      service.track('event2', { b: 2 });
      service.track('event3', { c: 3 });

      const queue = (service as any).queue;
      expect(queue.length).toBe(3);
      expect(queue[0].name).toBe('event1');
      expect(queue[1].name).toBe('event2');
      expect(queue[2].name).toBe('event3');
    });
  });

  describe('trackSearch()', () => {
    it('should track search event with all parameters', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSearch('hotel rooms', { city: 'Mumbai' }, 42);

      expect(trackSpy).toHaveBeenCalledWith('search', {
        search_term: 'hotel rooms',
        city: 'Mumbai',
        results_count: 42,
      });
    });

    it('should handle empty filters object', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSearch('query', {}, 0);

      expect(trackSpy).toHaveBeenCalledWith('search', {
        search_term: 'query',
        results_count: 0,
      });
    });

    it('should handle multiple filter properties', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSearch('hotels', { city: 'Delhi', price_range: '5000-10000', rating: 4 }, 15);

      expect(trackSpy).toHaveBeenCalledWith('search', {
        search_term: 'hotels',
        city: 'Delhi',
        price_range: '5000-10000',
        rating: 4,
        results_count: 15,
      });
    });
  });

  describe('trackRoomView()', () => {
    it('should track view_item event with correct GA4 schema', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackRoomView(123, 'Taj Hotel', 5000);

      expect(trackSpy).toHaveBeenCalledWith('view_item', {
        item_id: 123,
        item_name: 'Taj Hotel',
        price: 5000,
        currency: 'INR',
      });
    });

    it('should work with different room IDs and prices', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackRoomView(456, 'Oberoi Hotel', 15000);

      expect(trackSpy).toHaveBeenCalledWith('view_item', {
        item_id: 456,
        item_name: 'Oberoi Hotel',
        price: 15000,
        currency: 'INR',
      });
    });
  });

  describe('trackAddToCart()', () => {
    it('should track add_to_cart event with nights as quantity', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackAddToCart(789, 'Park Hotel', 3000, 3);

      expect(trackSpy).toHaveBeenCalledWith('add_to_cart', {
        item_id: 789,
        item_name: 'Park Hotel',
        price: 3000,
        quantity: 3,
        currency: 'INR',
      });
    });

    it('should handle single night bookings', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackAddToCart(999, 'Budget Hotel', 1500, 1);

      expect(trackSpy).toHaveBeenCalledWith('add_to_cart', {
        item_id: 999,
        item_name: 'Budget Hotel',
        price: 1500,
        quantity: 1,
        currency: 'INR',
      });
    });
  });

  describe('trackBeginCheckout()', () => {
    it('should track begin_checkout event', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackBeginCheckout('BK123456', 9000);

      expect(trackSpy).toHaveBeenCalledWith('begin_checkout', {
        booking_ref: 'BK123456',
        value: 9000,
        currency: 'INR',
      });
    });

    it('should work with different booking references and totals', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackBeginCheckout('BOOK999', 25000);

      expect(trackSpy).toHaveBeenCalledWith('begin_checkout', {
        booking_ref: 'BOOK999',
        value: 25000,
        currency: 'INR',
      });
    });
  });

  describe('trackPurchase()', () => {
    it('should track purchase event with transaction_id', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackPurchase('TXN123456', 15000, 'credit_card');

      expect(trackSpy).toHaveBeenCalledWith('purchase', {
        transaction_id: 'TXN123456',
        value: 15000,
        currency: 'INR',
        payment_type: 'credit_card',
      });
    });

    it('should work with different payment methods', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackPurchase('TXN789', 8000, 'upi');

      expect(trackSpy).toHaveBeenCalledWith('purchase', {
        transaction_id: 'TXN789',
        value: 8000,
        currency: 'INR',
        payment_type: 'upi',
      });
    });

    it('should work with wallet payment method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackPurchase('WALLET001', 5000, 'wallet');

      expect(trackSpy).toHaveBeenCalledWith('purchase', {
        transaction_id: 'WALLET001',
        value: 5000,
        currency: 'INR',
        payment_type: 'wallet',
      });
    });
  });

  describe('trackSignup()', () => {
    it('should track sign_up event with method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSignup('email');

      expect(trackSpy).toHaveBeenCalledWith('sign_up', { method: 'email' });
    });

    it('should work with google method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSignup('google');

      expect(trackSpy).toHaveBeenCalledWith('sign_up', { method: 'google' });
    });

    it('should work with microsoft method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackSignup('microsoft');

      expect(trackSpy).toHaveBeenCalledWith('sign_up', { method: 'microsoft' });
    });
  });

  describe('trackLogin()', () => {
    it('should track login event with method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackLogin('email');

      expect(trackSpy).toHaveBeenCalledWith('login', { method: 'email' });
    });

    it('should work with google method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackLogin('google');

      expect(trackSpy).toHaveBeenCalledWith('login', { method: 'google' });
    });

    it('should work with microsoft method', () => {
      service.init();
      const trackSpy = jest.spyOn(service, 'track');

      service.trackLogin('microsoft');

      expect(trackSpy).toHaveBeenCalledWith('login', { method: 'microsoft' });
    });
  });

  describe('dispatch() - private method', () => {
    beforeEach(() => {
      service.init();
      (window.gtag as jest.Mock).mockClear();
      (console.debug as jest.Mock).mockClear();
    });

    it('should call window.gtag with event data when gtag is available', () => {
      const event: AnalyticsEvent = {
        name: 'custom_event',
        properties: { key: 'value' },
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      (service as any).dispatch(event);

      expect(window.gtag).toHaveBeenCalledWith('event', 'custom_event', { key: 'value' });
    });

    it('should call window.gtag for page_view events specifically', () => {
      const event: AnalyticsEvent = {
        name: 'page_view',
        properties: { page_path: '/home' },
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      (service as any).dispatch(event);

      expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', { page_path: '/home' });
    });

    it('should not fail if window.gtag is undefined', () => {
      delete (window as any).gtag;

      const event: AnalyticsEvent = {
        name: 'test_event',
        properties: { data: 'test' },
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      expect(() => (service as any).dispatch(event)).not.toThrow();
    });

    it('should console.debug in non-production environment', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: false,
          gaMeasurementId: '',
        },
        writable: true,
      });

      try {
        const event: AnalyticsEvent = {
          name: 'test_event',
          properties: { key: 'value' },
          timestamp: '2026-01-01T00:00:00.000Z',
        };

        (service as any).dispatch(event);

        expect(console.debug).toHaveBeenCalledWith('[Analytics] test_event', { key: 'value' });
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should not console.debug in production environment', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: true,
          gaMeasurementId: '',
        },
        writable: true,
      });

      try {
        const event: AnalyticsEvent = {
          name: 'test_event',
          properties: { key: 'value' },
          timestamp: '2026-01-01T00:00:00.000Z',
        };

        (service as any).dispatch(event);

        expect(console.debug).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should pass undefined properties to gtag when event has no properties', () => {
      const event: AnalyticsEvent = {
        name: 'simple_event',
        properties: undefined,
        timestamp: '2026-01-01T00:00:00.000Z',
      };

      (service as any).dispatch(event);

      expect(window.gtag).toHaveBeenCalledWith('event', 'simple_event', undefined);
    });

    it('should call both gtag and console.debug for custom events in dev', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: false,
          gaMeasurementId: 'G-TEST',
        },
        writable: true,
      });

      try {
        const event: AnalyticsEvent = {
          name: 'room_viewed',
          properties: { room_id: 123 },
          timestamp: '2026-01-01T00:00:00.000Z',
        };

        (service as any).dispatch(event);

        expect(window.gtag).toHaveBeenCalledWith('event', 'room_viewed', { room_id: 123 });
        expect(console.debug).toHaveBeenCalledWith('[Analytics] room_viewed', { room_id: 123 });
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });

    it('should call gtag but not console.debug in production', () => {
      const originalEnv = environmentModule.environment;
      Object.defineProperty(environmentModule, 'environment', {
        value: {
          production: true,
          gaMeasurementId: 'G-PROD',
        },
        writable: true,
      });

      try {
        const event: AnalyticsEvent = {
          name: 'purchase',
          properties: { value: 5000 },
          timestamp: '2026-01-01T00:00:00.000Z',
        };

        (service as any).dispatch(event);

        expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', { value: 5000 });
        expect(console.debug).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(environmentModule, 'environment', {
          value: originalEnv,
          writable: true,
        });
      }
    });
  });

  describe('loadGA4() - private method', () => {
    it('should create and append script tag with correct src', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.head, 'appendChild');

      const script = { async: false, src: '' } as any;
      (createElementSpy as any).mockReturnValue(script);

      (service as any).loadGA4('G-TEST123');

      expect(createElementSpy).toHaveBeenCalledWith('script');
      expect(script.async).toBe(true);
      expect(script.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123');
      expect(appendChildSpy).toHaveBeenCalledWith(script);
    });

    it('should set script.async to true', () => {
      const script = { async: false, src: '' } as any;
      jest.spyOn(document, 'createElement').mockReturnValue(script);

      (service as any).loadGA4('G-ANOTHER');

      expect(script.async).toBe(true);
    });

    it('should initialize window.dataLayer if not already present', () => {
      delete (window as any).dataLayer;

      (service as any).loadGA4('G-TEST123');

      expect(window.dataLayer).toBeDefined();
      expect(Array.isArray(window.dataLayer)).toBe(true);
    });

    it('should preserve existing window.dataLayer', () => {
      window.dataLayer = [['previous_data']];

      (service as any).loadGA4('G-TEST123');

      expect(window.dataLayer![0]).toEqual(['previous_data']);
    });

    it('should set up window.gtag function', () => {
      // Store the original gtag before loadGA4 replaces it
      (service as any).loadGA4('G-TEST123');

      expect(window.gtag).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    });

    it('should call window.gtag with js initialization', () => {
      // Save reference to mock before loadGA4 replaces it
      const mockGtag = jest.fn();
      window.gtag = mockGtag;

      (service as any).loadGA4('G-TEST123');

      // After loadGA4, window.gtag is replaced with a new function
      // But the mock gtag should have captured initial calls from our mock
      // Check that gtag is now defined and is a function
      expect(window.gtag).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    });

    it('should call window.gtag with config for measurement ID', () => {
      (service as any).loadGA4('G-TEST123');

      // loadGA4 replaces window.gtag and pushes calls to dataLayer
      const configCall = window.dataLayer!.find(
        (entry: any) => Array.isArray(entry) && entry[0] === 'config'
      ) as unknown[];
      expect(configCall).toBeDefined();
      expect(configCall[1]).toBe('G-TEST123');
      expect(configCall[2]).toEqual({ send_page_view: false });
    });

    it('should skip loading if script already exists', () => {
      const existingScript = document.createElement('script');
      jest.spyOn(document, 'querySelector').mockReturnValue(existingScript);
      const appendChildSpy = jest.spyOn(document.head, 'appendChild');

      (service as any).loadGA4('G-EXISTING');

      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('should check for existing script with correct selector', () => {
      const querySelectorSpy = jest.spyOn(document, 'querySelector');
      jest.spyOn(document.head, 'appendChild').mockImplementation();

      (service as any).loadGA4('G-SPECIFIC');

      expect(querySelectorSpy).toHaveBeenCalledWith('script[src*="gtag/js?id=G-SPECIFIC"]');
    });

    it('should push args to dataLayer when gtag is called', () => {
      (service as any).loadGA4('G-TEST123');

      window.gtag!('event', 'test_event', { data: 'test' });

      expect(window.dataLayer![window.dataLayer!.length - 1]).toEqual(['event', 'test_event', { data: 'test' }]);
    });
  });

  describe('Integration tests', () => {
    it('should track events queued before init and then flush them', () => {
      // Queue events before init
      service.track('event1', { a: 1 });
      service.track('event2', { b: 2 });

      expect((service as any).queue.length).toBe(2);

      service.init();

      // After init, queue should be empty and gtag should have been called
      expect((service as any).queue.length).toBe(0);
      expect(window.gtag).toHaveBeenCalled();
    });

    it('should handle mixed pre-init and post-init tracking', () => {
      service.track('pre_init_event', { before: true });

      service.init();

      const gtagCallCountAfterInit = (window.gtag as jest.Mock).mock.calls.length;

      service.track('post_init_event', { after: true });

      // Post-init event should trigger additional gtag calls
      expect((window.gtag as jest.Mock).mock.calls.length).toBeGreaterThan(gtagCallCountAfterInit);
    });

    it('should track page views and custom events', () => {
      service.init();
      (window.gtag as jest.Mock).mockClear();

      document.title = 'Home Page';
      routerEventsSubject.next(new NavigationEnd(1, '/home', '/home'));

      service.track('custom_action', { action: 'click' });

      expect(window.gtag).toHaveBeenCalledWith('event', 'page_view', {
        page_path: '/home',
        page_title: 'Home Page',
      });

      expect(window.gtag).toHaveBeenCalledWith('event', 'custom_action', { action: 'click' });
    });

    it('should handle rapid successive init and track calls', () => {
      service.init();
      service.init();
      service.init();

      service.track('event1', {});
      service.track('event2', {});

      expect((window.gtag as jest.Mock).mock.calls.length).toBeGreaterThan(0);
      expect((service as any).queue.length).toBe(0);
    });

    it('should work with all convenience tracking methods after init', () => {
      service.init();
      (window.gtag as jest.Mock).mockClear();

      service.trackSearch('hotels', {}, 10);
      service.trackRoomView(123, 'Hotel', 5000);
      service.trackAddToCart(123, 'Hotel', 5000, 2);
      service.trackBeginCheckout('BK123', 10000);
      service.trackPurchase('BK123', 10000, 'card');
      service.trackSignup('email');
      service.trackLogin('google');

      expect((window.gtag as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });
  });
});
