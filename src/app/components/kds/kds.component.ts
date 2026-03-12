import { Component, OnInit, signal, inject, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../supabase.service';
import { Order } from '../../models/cafe.models';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kds.component.html',
  styles: ``,
})
export class KdsComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private subscription?: RealtimeChannel;

  orders = signal<Order[]>([]);
  completedOrdersCount = signal(0);
  currentTab = signal<'active' | 'completed'>('active');
  
  // New: Date Filters for Completed Tab
  dateFilter = signal<'today' | '7days' | 'custom'>('today');
  customFrom = signal<string>(new Date().toISOString().split('T')[0]);
  customTo = signal<string>(new Date().toISOString().split('T')[0]);
  
  // New: Order expansion for details
  expandedOrderId = signal<string | null>(null);

  now = Date.now();
  private timerInterval?: any;

  async ngOnInit() {
    await this.fetchOrders();
    await this.fetchStats();
    this.setupSubscription();
    
    this.zone.runOutsideAngular(() => {
      this.timerInterval = setInterval(() => {
        this.now = Date.now();
        this.cdr.detectChanges();
      }, 1000);
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.supabase.client.removeChannel(this.subscription);
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  async setTab(tab: 'active' | 'completed') {
    this.currentTab.set(tab);
    await this.fetchOrders();
  }

  async setDateFilter(filter: 'today' | '7days' | 'custom') {
    this.dateFilter.set(filter);
    await this.fetchOrders();
  }

  async fetchOrders() {
    if (this.currentTab() === 'active') {
      const { data } = await this.supabase.getActiveOrders();
      this.orders.set(data || []);
    } else {
      // Apply date filtering for completed tab
      let fromDate = new Date();
      let toDate = new Date();

      if (this.dateFilter() === 'today') {
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
      } else if (this.dateFilter() === '7days') {
        fromDate.setDate(fromDate.getDate() - 7);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
      } else {
        fromDate = new Date(this.customFrom());
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(this.customTo());
        toDate.setHours(23, 59, 59, 999);
      }

      const { data } = await this.supabase.getCompletedOrdersByDateRange(
        fromDate.toISOString(),
        toDate.toISOString()
      );
      this.orders.set(data || []);
    }
    this.cdr.markForCheck();
  }

  async fetchStats() {
    const { count } = await this.supabase.countCompletedOrders();
    this.completedOrdersCount.set(count);
  }

  setupSubscription() {
    this.subscription = this.supabase.subscribeToOrders(async () => {
      await this.fetchOrders();
      await this.fetchStats();
    });
  }

  async updateStatus(orderId: string, status: Order['status']) {
    const { error } = await this.supabase.updateOrderStatus(orderId, status);
    if (!error) {
      await this.fetchOrders();
      await this.fetchStats();
    }
  }

  /** KDS: Confirm cash received AND mark as served together */
  async confirmCashPayment(orderId: string) {
    const { error } = await this.supabase.client
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_mode: 'cash',
        payment_id: 'CASH-' + Date.now(),
        status: 'served' // Mark as served immediately when staff confirms cash
      })
      .eq('id', orderId);

    if (!error) {
      await this.fetchOrders();
      await this.fetchStats();
    }
  }

  toggleOrderDetails(orderId: string) {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  getTimeElapsed(createdAt: string): string {
    const start = new Date(createdAt).getTime();
    const elapsed = this.now - start;
    const totalMins = Math.floor(elapsed / 1000 / 60);
    const secs = Math.floor((elapsed / 1000) % 60);
    return `${totalMins}:${secs.toString().padStart(2, '0')}m`;
  }
}
