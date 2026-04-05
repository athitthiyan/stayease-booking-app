import { TestBed } from '@angular/core/testing';

import { SearchMapPlaceholderComponent } from './search-map-placeholder.component';

describe('SearchMapPlaceholderComponent', () => {
  it('renders the current result count, city label, and location fallbacks', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [SearchMapPlaceholderComponent],
    }).createComponent(SearchMapPlaceholderComponent);

    fixture.componentRef.setInput('cityLabel', 'Paris');
    fixture.componentRef.setInput('rooms', [
      {
        id: 1,
        hotel_name: 'Azure Stay',
        room_type: 'suite',
        price: 200,
        availability: true,
        rating: 4.7,
        review_count: 12,
        max_guests: 2,
        beds: 1,
        bathrooms: 1,
        is_featured: false,
        created_at: '2026-04-01T00:00:00.000Z',
        location: 'Paris, France',
      },
      {
        id: 2,
        hotel_name: 'City Lights',
        room_type: 'deluxe',
        price: 180,
        availability: true,
        rating: 4.4,
        review_count: 8,
        max_guests: 2,
        beds: 1,
        bathrooms: 1,
        is_featured: true,
        created_at: '2026-04-01T00:00:00.000Z',
        city: 'Paris',
      },
      {
        id: 3,
        hotel_name: 'Future Stay',
        room_type: 'standard',
        price: 120,
        availability: true,
        rating: 4.1,
        review_count: 4,
        max_guests: 2,
        beds: 1,
        bathrooms: 1,
        is_featured: false,
        created_at: '2026-04-01T00:00:00.000Z',
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('3 stays in current results');
    expect(element.textContent).toContain('Paris');
    expect(element.textContent).toContain('Paris, France');
    expect(element.textContent).toContain('Location coming soon');
  });
});
