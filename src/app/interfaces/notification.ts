export interface Notification {
    id: string | number;
    created_at: string;
    message: string;
    type: string;
    is_read: boolean;
    link?: string;
}
