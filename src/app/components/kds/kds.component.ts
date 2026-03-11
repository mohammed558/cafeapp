import { Component, OnInit, signal, inject, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase.service';
import { Order } from '../../models/cafe.models';
import { RealtimeChannel } from '@supabase/supabase-js';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule],
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
  now = Date.now(); // plain number — updated every second
  private timerInterval?: any;

  async ngOnInit() {
    await this.fetchOrders();
    await this.fetchStats();
    this.setupSubscription();
    
    // Run interval OUTSIDE Angular zone to avoid triggering full app CD on every tick
    // Then use zone.run() to update `now` and call detectChanges() only in this component
    this.zone.runOutsideAngular(() => {
      this.timerInterval = setInterval(() => {
        this.now = Date.now();
        this.cdr.detectChanges(); // only re-renders THIS component
      }, 1000); // update every second — smooth live clock
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

  async fetchOrders() {
    const { data } = this.currentTab() === 'active' 
      ? await this.supabase.getActiveOrders()
      : await this.supabase.getCompletedOrders();
    
    if (data) {
      this.orders.set(data);
      this.cdr.markForCheck();
    }
  }

  async fetchStats() {
    const { count } = await this.supabase.countCompletedOrders();
    this.completedOrdersCount.set(count);
  }

  setupSubscription() {
    this.subscription = this.supabase.subscribeToOrders(async (payload) => {
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

  /** KDS: Confirm cash received for an order awaiting cash payment */
  async confirmCashPayment(orderId: string) {
    const { error } = await this.supabase.client
      .from('orders')
      .update({
        payment_status: 'completed',
        payment_mode: 'cash',
        payment_id: 'CASH-' + Date.now()
      })
      .eq('id', orderId);

    if (!error) {
      await this.fetchOrders();
    }
  }

  /** Only show elapsed time for active (non-served) orders */
  getTimeElapsed(createdAt: string): string {
    const start = new Date(createdAt).getTime();
    const elapsed = this.now - start; // this.now is a plain number updated every second
    const totalMins = Math.floor(elapsed / 1000 / 60);
    const secs = Math.floor((elapsed / 1000) % 60);
    return `${totalMins}:${secs.toString().padStart(2, '0')}m`;
  }
}
