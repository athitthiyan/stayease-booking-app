import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SupportComponent } from './support.component';

describe('SupportComponent', () => {
  let component: SupportComponent;
  let fixture: ComponentFixture<SupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SupportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display support heading', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Need help with a booking?');
  });

  it('should display support cards', () => {
    const compiled = fixture.nativeElement;
    const cards = compiled.querySelectorAll('.support-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should display contact information', () => {
    const compiled = fixture.nativeElement;
    const contactSection = compiled.querySelector('.support-contact');
    expect(contactSection).toBeTruthy();
  });
});
