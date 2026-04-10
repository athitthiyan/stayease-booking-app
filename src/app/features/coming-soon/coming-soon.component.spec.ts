import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComingSoonComponent } from './coming-soon.component';

describe('ComingSoonComponent', () => {
  let component: ComingSoonComponent;
  let fixture: ComponentFixture<ComingSoonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComingSoonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComingSoonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display coming soon message', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Coming Soon');
  });

  it('should display status indicator', () => {
    const compiled = fixture.nativeElement;
    const statusDot = compiled.querySelector('.coming-soon__status-dot');
    expect(statusDot).toBeTruthy();
  });
});
