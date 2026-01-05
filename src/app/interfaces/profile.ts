import { roles } from '../enums/role'

export interface UserProfile {
    id: string

    email: string

    name: string

    role: roles

    telegram_id: string | null

    is_active?: boolean

    created_at: string

    updated_at: string
}
