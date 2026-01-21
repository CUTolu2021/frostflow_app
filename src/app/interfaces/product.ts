export interface Product {
    id: string; // uuid
    organization_id?: string; // uuid
    name: string;
    category?: string;
    created_by?: string;

    // Price Logic
    unit_price: number;
    box_price?: number; // Price per box
    cost_price?: number; // Cost price per unit

    // Catch Weight Logic
    base_unit: string; // default 'kg'
    is_variable_weight: boolean; // default false
    standard_box_weight?: number | null; // null if variable

    image_url?: string;
    is_active: boolean;
    created_at?: string;

    // UI specific (optional)
    unit?: number;
    status?: 'In Stock' | 'Low Stock' | 'Out of Stock';
}
