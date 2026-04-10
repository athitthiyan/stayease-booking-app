import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NotFoundComponent } from './not-found.component';

describe('NotFoundComponent', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent, RouterTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display page not found message', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('should display action buttons', () => {
    const compiled = fixture.nativeElement;
    const buttons = compiled.querySelectorAll('.btn');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should have links to browse and home', () => {
    const compiled = fixture.nativeElement;
    const links = compiled.querySelectorAll('a[routerLink]');
    expect(links.length).toBeGreaterThan(0);
  });
});
