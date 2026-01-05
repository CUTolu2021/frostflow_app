import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesReceiveComponent } from './sales-receive.component';

describe('SalesReceiveComponent', () => {
  let component: SalesReceiveComponent;
  let fixture: ComponentFixture<SalesReceiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesReceiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SalesReceiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
