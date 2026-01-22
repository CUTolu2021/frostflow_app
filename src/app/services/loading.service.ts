import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LoadingService {
    private _loading = new BehaviorSubject<boolean>(false);
    public readonly loading$ = this._loading.asObservable();

    private requestCount = 0;

    show() {
        this.requestCount++;
        if (this.requestCount > 0) {
            this._loading.next(true);
        }
    }

    hide() {
        this.requestCount--;
        if (this.requestCount <= 0) {
            this.requestCount = 0;
            this._loading.next(false);
        }
    }
}
