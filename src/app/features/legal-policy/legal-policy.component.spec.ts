import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { LegalPolicyComponent } from './legal-policy.component';

describe('LegalPolicyComponent', () => {
  it('returns route data content when available', async () => {
    const routeContent = {
      eyebrow: 'Legal',
      title: 'Privacy Policy',
      intro: 'We value your privacy.',
      sections: [{ heading: 'Data', body: 'We collect minimal data.' }],
    };

    await TestBed.configureTestingModule({
      imports: [LegalPolicyComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { content: routeContent } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalPolicyComponent);
    const component = fixture.componentInstance;

    expect(component.content()).toEqual(routeContent);
  });

  it('returns fallback content when route data is missing', async () => {
    await TestBed.configureTestingModule({
      imports: [LegalPolicyComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: {} } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalPolicyComponent);
    const component = fixture.componentInstance;

    expect(component.content().title).toBe('Policy Information');
    expect(component.content().sections).toEqual([]);
  });
});
