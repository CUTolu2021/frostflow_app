import { Product } from './product';

export interface ReconciliationMismatch {
    id: string;
    created_at: string;
    window_date?: string;
    product_id: string;
    system_quantity: number;
    staff_quantity: number;
    owner_quantity: number;
    difference: number;
    status: statusEnum;
    is_escalated?: boolean;
    escalated_at?: string | null;
    owner_units?: string[];
    staff_units?: string[];
    normalized_unit?: string;

    // Joins
    products?: Product;
}

export enum statusEnum {
    MISMATCH = 'Mismatch',
    MISSING_IN_SALES = 'Missing In Sales',
    EXTRA_IN_SALES = 'Extra In Sales',
    MATCH = 'Match',
    RESOLVED = 'Resolved',
}
