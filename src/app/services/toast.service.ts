import { Injectable, signal } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { Toast } from '../interfaces/toast'

@Injectable({
    providedIn: 'root',
})
export class ToastService {
    toasts = signal<Toast[]>([])
    private toastCounter = 0

    show(
        message: string,
        type: 'success' | 'error' | 'login' | 'logout' | 'info' = 'info'
    ) {
        const currentToasts = this.toasts()
        const id = this.toastCounter++

        const newToast: Toast = { message, type, id }

        this.toasts.set([...currentToasts, newToast])

        setTimeout(() => {
            this.remove(id)
        }, 3000)
    }

    remove(id: number) {
        const currentToasts = this.toasts()
        this.toasts.set(currentToasts.filter((t: Toast) => t.id !== id))
    }
}
