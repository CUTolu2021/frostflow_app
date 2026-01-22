export interface Toast {
    message: string
    type: 'success' | 'error' | 'info' | 'login' | 'logout'
    id: number
}