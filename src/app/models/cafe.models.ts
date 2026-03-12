export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  created_at?: string;
  categories?: { name: string }; // For joined queries
}

export interface Order {
  id: string;
  customer_name: string;
  table_number: number;
  total_price: number;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  payment_status: 'pending' | 'completed' | 'failed';
  payment_mode?: 'paypal' | 'cash';
  payment_id?: string;
  user_id?: string;
  created_at?: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  menu_items?: MenuItem; // For joined queries
}
