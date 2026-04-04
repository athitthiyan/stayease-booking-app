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

  it('renders brand, navigation links, and portfolio links', () => {
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Stay');
    expect(element.textContent).toContain('Explore');
    expect(element.textContent).toContain('Destinations');
    expect(element.textContent).toContain('Portfolio');
    expect(element.querySelectorAll('.footer__socials a').length).toBe(3);
    expect(Array.from(element.querySelectorAll('a')).some(anchor => anchor.textContent?.includes('PayFlow'))).toBe(true);
  });
});
