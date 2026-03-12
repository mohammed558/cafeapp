import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Category, MenuItem, Order } from '../../models/cafe.models';
import { AuthComponent } from '../auth/auth.component';
import { OrderHistoryComponent } from '../order-history/order-history.component';

declare var paypal: any;

@Component({
  selector: 'app-ordering-menu',
  standalone: true,
  imports: [CommonModule, AuthComponent, OrderHistoryComponent],
  templateUrl: './ordering-menu.component.html',
  styles: `
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes bounce-in {
      0% { opacity: 0; transform: scale(0.3); }
      50% { opacity: 0.9; transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
  `,
})
export class OrderingMenuComponent implements OnInit {
  private supabase = inject(SupabaseService);
  public cart = inject(CartService);
  public auth = inject(AuthService);

  categories = signal<Category[]>([]);
  menuItems = signal<MenuItem[]>([]);
  selectedCategoryId = signal<string | null>(null);
  selectedTable = signal<number | null>(null);
  activeOrders = signal<Order[]>([]);
  showEBill = signal<boolean>(false);
  selectedEBillOrder = signal<Order | null>(null);

  // Modal states
  showHistoryModal = signal(false);

  // Computed: is the auth gate needed?
  get needsLogin() { return !this.auth.isAuthenticated; }

  filteredMenuItems = computed(() => {
    const categoryId = this.selectedCategoryId();
    if (!categoryId) return this.menuItems();
    return this.menuItems().filter(item => item.category_id === categoryId);
  });

  // Computed: total across all active orders (for unified billing)
  unifiedTotal = computed(() =>
    this.activeOrders().reduce((sum, o) => sum + o.total_price, 0)
  );

  async ngOnInit() {
    // Register global callbacks for child components
    (window as any).closeHistory = () => this.showHistoryModal.set(false);
    (window as any).viewBillFromHistory = (order: Order) => {
      this.selectedEBillOrder.set(order);
      this.showEBill.set(true);
      this.showHistoryModal.set(false);
    };

    const { data: catData } = await this.supabase.getCategories();
    this.categories.set(catData || []);

    const { data: menuData } = await this.supabase.getMenuItems();
    this.menuItems.set(menuData || []);

    // --- Restore session state ---
    // Wait briefly for auth to resolve from Supabase session
    await this.waitForAuth();

    const savedTable = localStorage.getItem('selectedTable');
    if (savedTable && this.auth.isAuthenticated) {
      const tableNum = parseInt(savedTable);
      this.selectedTable.set(tableNum);
      await this.fetchUserActiveOrders(tableNum);
    }

    this.setupOrderSubscription();
  }

  /** Poll auth state for up to 2 seconds to let session resolve */
  private waitForAuth(): Promise<void> {
    return new Promise(resolve => {
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (this.auth.isAuthenticated || tries >= 20) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  toggleHistory() {
    this.showHistoryModal.set(true);
  }

  logout() {
    this.auth.signOut();
    this.selectedTable.set(null);
    this.activeOrders.set([]);
    this.cart.clearCart();
    localStorage.removeItem('selectedTable');
  }

  async fetchUserActiveOrders(tableNum: number) {
    const user = this.auth.currentUser();
    if (!user) return;
    const { data } = await this.supabase.getUserActiveOrders(user.id, tableNum);
    this.activeOrders.set(data || []);
  }

  setupOrderSubscription() {
    this.supabase.subscribeToOrders(async (payload) => {
      const tableNum = this.selectedTable();
      if (tableNum && this.auth.isAuthenticated) {
        await this.fetchUserActiveOrders(tableNum);

        // Show E-bill when payment is completed for this user's order
        if (payload.new && payload.new.table_number === tableNum &&
            payload.new.payment_status === 'completed' &&
            payload.old?.payment_status !== 'completed') {
          const { data } = await this.supabase.getOrderById(payload.new.id);
          if (data && data.user_id === this.auth.currentUser()?.id) {
            this.selectedEBillOrder.set(data);
            this.showEBill.set(true);
          }
        }
      }
    });
  }

  initPayPal(order: Order) {
    const containerId = `paypal-button-container-${order.id}`;
    const container = document.getElementById(containerId);
    if (!container || container.childElementCount > 0) return;

    paypal.Buttons({
      createOrder: (_data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: order.total_price.toString() } }]
        });
      },
      onApprove: async (_data: any, actions: any) => {
        const captured = await actions.order.capture();
        this.handlePaymentSuccess(captured.id, 'paypal', order);
      },
      onError: (err: any) => console.error('PayPal Error:', err)
    }).render(`#${containerId}`);
  }

  async handlePaymentSuccess(paymentId: string, paymentMode: 'paypal' | 'cash' = 'paypal', order: Order) {
    const { error } = await this.supabase.client
      .from('orders')
      .update({ payment_status: 'completed', payment_id: paymentId, payment_mode: paymentMode })
      .eq('id', order.id);

    if (!error) {
      const { data } = await this.supabase.getOrderById(order.id);
      if (data) {
        this.selectedEBillOrder.set(data);
        this.showEBill.set(true);
      }
      const table = this.selectedTable();
      if (table) await this.fetchUserActiveOrders(table);
    }
  }

  async handleCashPayment(order: Order) {
    if (!order) return;
    if (confirm('Please go to the counter to pay in cash.\nStaff will confirm receipt on their end.\n\nClick OK to notify staff.')) {
      await this.supabase.client
        .from('orders')
        .update({ payment_mode: 'cash' })
        .eq('id', order.id);
      const table = this.selectedTable();
      if (table) await this.fetchUserActiveOrders(table);
    }
  }

  selectTable(n: number) {
    this.selectedTable.set(n);
    localStorage.setItem('selectedTable', n.toString());
    this.fetchUserActiveOrders(n);
  }

  selectCategory(id: string | null) {
    this.selectedCategoryId.set(id);
  }

  addToOrder(item: MenuItem) {
    this.cart.addToCart(item);
  }

  async placeOrder() {
    const items = this.cart.items();
    const table = this.selectedTable();
    const user = this.auth.currentUser();

    if (items.length === 0 || !table || !user) return;

    const order: Partial<Order> = {
      customer_name: user.email ?? 'Guest',
      table_number: table,
      total_price: this.cart.totalPrice(),
      status: 'pending',
      payment_status: 'pending',
      user_id: user.id
    };

    const result = await this.supabase.createOrder(order, items);
    if (!result.error && 'data' in result && result.data) {
      await this.fetchUserActiveOrders(table);
      this.cart.clearCart();
    } else {
      alert('Failed to place order. Please try again.');
    }
  }

  closeEBill() {
    this.showEBill.set(false);
    this.selectedEBillOrder.set(null);
  }
}
