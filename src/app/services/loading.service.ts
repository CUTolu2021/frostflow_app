import { Injectable, signal } from '@angular/core';


@Injectable({
    providedIn: 'root'
})
export class LoadingService {
    public _loading = signal<boolean>(false);

    private requestCount = 0;

    show() {
        this.requestCount++;
        if (this.requestCount > 0) {
            this._loading.set(true);
        }
    }

    hide() {
        this.requestCount--;
        if (this.requestCount <= 0) {
            this.requestCount = 0;
            this._loading.set(false);
        }
    }
}
