export interface StockMovement {
    total_items_added: number;
    total_items_sold: number;
}

export interface MismatchRecord {
    product: string;
    difference: number | string;
}

export interface AIStockReport {
    id: string;
    organization_id?: string;
    created_at: string;
    report_period_start: string;
    report_period_end: string;
    summary: string;
    stock_movement: StockMovement;
    mismatch_records: MismatchRecord[];
    recommendations: string[];
}
