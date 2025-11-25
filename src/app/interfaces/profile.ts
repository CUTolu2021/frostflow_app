import { roles } from "../enums/role"

export interface UserProfile{
    id: string,

    email: string

    name: string,

    role: roles

    telegram_id: string | null,

    created_at: string,

    updated_at: string
}