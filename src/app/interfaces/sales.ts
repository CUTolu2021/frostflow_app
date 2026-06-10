import { Product } from './product';

export interface SalePayment {
    id?: string;
    sale_id?: string;
    method: string;
    amount: number;
    reference_note?: string | null;
    created_at?: string;
}

export interface Sale {
    id: string;
    created_at: string;
    product_id: string;
    quantity: number;
    total_price: number;
    unit_type: string;
    payment_method: string;
    selling_price?: number;
    status: 'completed' | 'voided' | 'rejected';
    recorded_by: string;
    invoice_id?: string;


    products?: Product;
    users?: { name: string };
    sale_payments?: SalePayment[];
}

export interface DailySales {
    id: string;
    created_at: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    unit_type: string;
    payment_method: string;
    recorded_by: string;
    payments?: SalePayment[];
    invoice_id?: string;
}

export interface GroupedSale {
    invoice_id: string;
    raw_date: string;
    time: string;
    staff_name: string;
    total: number;
    payment_method: string;
    status: string;
    items: Sale[];
    item_summary: string;
    payment_summary?: string;
    payments?: SalePayment[];
}
