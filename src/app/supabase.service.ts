import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { Category, MenuItem, Order, OrderItem } from './models/cafe.models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  async getCategories() {
    return await this.supabase
      .from('categories')
      .select('*')
      .order('name') as { data: Category[] | null, error: any };
  }

  async getMenuItems() {
    return await this.supabase
      .from('menu_items')
      .select('*, categories(name)')
      .order('name') as { data: MenuItem[] | null, error: any };
  }

  async createOrder(order: Partial<Order>, items: OrderItem[]) {
    // order will now potentially contain user_id
    const { data: orderData, error: orderError } = await this.supabase
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (orderError) return { error: orderError };

    const orderItems = items.map(item => ({
      order_id: orderData.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }));

    const { error: itemsError } = await this.supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) return { error: itemsError };

    // Fetch the full order with items for the e-bill
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('id', orderData.id)
      .single() as { data: Order | null, error: any };
  }

  async getActiveOrders() {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .not('status', 'eq', 'cancelled')          // exclude cancelled
      .not('payment_status', 'eq', 'completed')   // exclude paid orders
      .order('created_at', { ascending: true }) as { data: Order[] | null, error: any };
  }

  async getTableActiveOrders(tableNumber: number) {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('table_number', tableNumber)
      .not('status', 'eq', 'cancelled')
      .not('payment_status', 'eq', 'completed')
      .order('created_at', { ascending: true }) as { data: Order[] | null, error: any };
  }

  async updateOrderStatus(orderId: string, status: string) {
    return await this.supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
  }
  async getCompletedOrders() {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('status', 'served')
      .order('created_at', { ascending: false })
      .limit(50) as { data: Order[] | null, error: any };
  }

  async getCompletedOrdersByDateRange(from: string, to: string) {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('status', 'served')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false }) as { data: Order[] | null, error: any };
  }

  async getUserActiveOrders(userId: string, tableNumber: number) {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('user_id', userId)
      .eq('table_number', tableNumber)
      .not('status', 'eq', 'cancelled')
      .not('payment_status', 'eq', 'completed')
      .order('created_at', { ascending: true }) as { data: Order[] | null, error: any };
  }

  async getOrderById(orderId: string) {
    return await this.supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('id', orderId)
      .single() as { data: Order | null, error: any };
  }

  async countCompletedOrders() {
    const { count, error } = await this.supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'served');
    return { count: count || 0, error };
  }

  subscribeToOrders(callback: (payload: any) => void) {
    return this.supabase
      .channel('orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, callback)
      .subscribe();
  }
}
