import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders brand, navigation links, and guest support links', () => {
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Stayvora');
    expect(element.textContent).toContain('Explore');
    expect(element.textContent).toContain('Policies');
    expect(element.textContent).toContain('Support');
    expect(Array.from(element.querySelectorAll('a')).some(anchor => anchor.textContent?.includes('My Bookings'))).toBe(true);
    expect(Array.from(element.querySelectorAll('a')).some(anchor => anchor.textContent?.includes('Saved Stays'))).toBe(true);
  });
});
