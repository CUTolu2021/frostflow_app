export interface Notification {
    id: string;
    created_at: string;
    message: string;
    type: 'alert' | 'info' | 'success' | 'warning';
    is_read: boolean;
    link?: string;
}
