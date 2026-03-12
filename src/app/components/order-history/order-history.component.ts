import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase.service';
import { AuthService } from '../../services/auth.service';
import { Order } from '../../models/cafe.models';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 max-w-[600px] mx-auto pb-32">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-black text-slate-900 dark:text-white">Order History</h2>
        <button (click)="onClose()" class="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div *ngIf="loading()" class="flex flex-col items-center justify-center py-20">
        <div class="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading History...</p>
      </div>

      <div *ngIf="!loading() && orders().length === 0" class="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
        <div class="size-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
          <span class="material-symbols-outlined text-4xl">history_toggle_off</span>
        </div>
        <p class="text-slate-500 font-bold">No orders found yet</p>
        <p class="text-xs text-slate-400 mt-1">Start ordering to see them here!</p>
      </div>

      <div class="space-y-4">
        <div *ngFor="let order of orders()" class="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 hover:border-primary/30 transition-all shadow-sm">
          <div class="flex justify-between items-start mb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-black text-slate-400 uppercase tracking-widest">#{{order.id.slice(-6)}}</span>
                <span [class]="getStatusClass(order.status)" class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter">
                  {{order.status}}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium">{{order.created_at | date:'medium'}}</p>
            </div>
            <div class="text-right">
              <p class="text-xl font-black text-slate-900 dark:text-white mb-1">\${{order.total_price}}</p>
              <span *ngIf="order.payment_status === 'completed'" class="text-[8px] font-black uppercase text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Paid</span>
              <span *ngIf="order.payment_status !== 'completed'" class="text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Pending</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800/50">
            <div class="flex items-center gap-2">
                <div class="flex -space-x-2">
                  <div *ngFor="let item of (order.order_items || []).slice(0, 3)" class="size-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 flex items-center justify-center text-[8px] font-black">
                    {{item.menu_items?.name?.charAt(0)}}
                  </div>
                </div>
                <span class="text-[9px] font-bold text-slate-400" *ngIf="(order.order_items?.length || 0) > 3">+{{(order.order_items?.length || 0) - 3}} more</span>
                <span class="text-[9px] font-bold text-slate-400" *ngIf="(order.order_items?.length || 0) <= 3">{{order.order_items?.length || 0}} items</span>
            </div>
            <button (click)="viewBill(order)" class="flex items-center gap-2 text-primary font-black text-[10px] uppercase hover:gap-3 transition-all">
              View Receipt <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class OrderHistoryComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  
  orders = signal<Order[]>([]);
  loading = signal(true);

  async ngOnInit() {
    await this.fetchHistory();
  }

  async fetchHistory() {
    const user = this.auth.currentUser();
    if (!user) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    const { data, error } = await this.supabase.client
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) {
      this.orders.set(data || []);
    }
    this.loading.set(false);
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'pending': return 'bg-slate-100 text-slate-400';
      case 'preparing': return 'bg-primary/10 text-primary';
      case 'ready': return 'bg-green-100 text-green-600';
      case 'served': return 'bg-slate-900 text-white dark:bg-white dark:text-slate-900';
      default: return 'bg-slate-100 text-slate-400';
    }
  }

  viewBill(order: Order) {
    (window as any).viewBillFromHistory?.(order);
  }

  onClose() {
    (window as any).closeHistory?.();
  }
}
