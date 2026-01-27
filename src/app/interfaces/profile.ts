import { UserRole } from '../enums/role'

export interface UserProfile {
    id: string

    email: string

    name: string

    role: UserRole

    telegram_id: string | null

    is_active?: boolean

    created_at: string

    updated_at: string
}

export interface PostgresChangePayload<T> {
    schema: string
    table: string
    commit_timestamp: string
    eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    new: T
    old: Partial<T>
}
