import { Product } from './product';

export interface StockEntry {
    product_id: string;
    created_at?: string;
    quantity: number;
    input_quantity?: number;
    unit_type: string;
    total_weight?: number;
    reference_note?: string;
    recorded_by: string;
    unit_cost?: number;
    unit_price?: number;
    box_price?: number;
    total_cost?: number;
    logistics_fee?: number;
    products?: Product;
}

export interface StaffStockEntry {
    id: string;
    created_at: string;
    product_id: string;
    quantity: number;
    unit_type: string;
    recorded_by: string;
    metadata?: {
        damaged_qty?: number;
        notes?: string;
    };


    products?: Product;
}

export interface ProductHistoryItem {
    id: string;
    date: string;
    type: 'IN' | 'OUT';
    quantity: number;
    unit: string;
    original_qty?: number;
    original_unit?: string;
    note?: string;
}
