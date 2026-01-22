import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
// import { Toast } from '../interfaces/toast'

export interface Toast {
    message: string
    type: 'success' | 'error' | 'info' | 'login' | 'logout'
    id: number
}
@Injectable({
    providedIn: 'root',
})
export class ToastService {
    toasts$ = new BehaviorSubject<Toast[]>([])
    private toastCounter = 0

    show(
        message: string,
        type: 'success' | 'error' | 'login' | 'logout' | 'info' = 'info'
    ) {
        const currentToasts = this.toasts$.value
        const id = this.toastCounter++

        const newToast: Toast = { message, type, id }

        this.toasts$.next([...currentToasts, newToast])

        setTimeout(() => {
            this.remove(id)
        }, 3000)
    }

    remove(id: number) {
        const currentToasts = this.toasts$.value
        this.toasts$.next(currentToasts.filter((t) => t.id !== id))
    }
}
