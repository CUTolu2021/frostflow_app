import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesLookupComponent } from './sales-lookup.component';

describe('SalesLookupComponent', () => {
  let component: SalesLookupComponent;
  let fixture: ComponentFixture<SalesLookupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesLookupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesLookupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
