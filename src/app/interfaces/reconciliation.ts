import { Product } from './product';

export interface ReconciliationMismatch {
    id: string;
    created_at: string;
    product_id: string;
    system_quantity: number;
    staff_quantity: number;
    owner_quantity: number;
    difference: number;
    status: statusEnum;

    // Joins
    products?: Product;
}

export enum statusEnum {
    MISMATCH = 'MISMATCH',
    MISSING_IN_SALES = 'MISSING IN SALES',
    EXTRA_IN_SALES = 'EXTRA IN SALES'
}