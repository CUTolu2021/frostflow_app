import { Product } from './product';

export interface ExpenseRecord {
    id: string;
    expense_type: 'stock_purchase' | 'misc';
    expense_date: string;
    created_at?: string;
    description: string;
    category: string;
    quantity?: number | null;
    unit_type?: string | null;
    unit_cost?: number | null;
    goods_cost?: number;
    logistics_fee?: number;
    amount: number;
    notes?: string;
    products?: Product | null;
    created_by_name?: string | null;
}

export interface CreateExpensePayload {
    description: string;
    category: string;
    amount: number;
    expenseDate: string;
    notes?: string;
}
