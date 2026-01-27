export interface Product {
    id: string;
    organization_id?: string;
    name: string;
    category?: string;
    created_by?: string;


    unit_price: number;
    box_price?: number;
    cost_price?: number;


    base_unit: string;
    is_variable_weight: boolean;
    standard_box_weight?: number | null;

    image_url?: string;
    is_active: boolean;
    created_at?: string;


    unit?: number;
    status?: 'In Stock' | 'Low Stock' | 'Out of Stock';
}
