import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockentryComponent } from './stockentry.component';

describe('StockentryComponent', () => {
  let component: StockentryComponent;
  let fixture: ComponentFixture<StockentryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockentryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockentryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
