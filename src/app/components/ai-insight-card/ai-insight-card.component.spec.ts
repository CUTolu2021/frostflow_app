import { ComponentFixture, TestBed } from '@angular/core/testing'

import { AiInsightCardComponent } from './ai-insight-card.component'

describe('AiInsightCardComponent', () => {
    let component: AiInsightCardComponent
    let fixture: ComponentFixture<AiInsightCardComponent>

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AiInsightCardComponent],
        }).compileComponents()

        fixture = TestBed.createComponent(AiInsightCardComponent)
        component = fixture.componentInstance
        fixture.detectChanges()
    })

    it('should create', () => {
        expect(component).toBeTruthy()
    })
})
