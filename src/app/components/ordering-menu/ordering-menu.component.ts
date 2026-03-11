import { Component, OnInit, signal, computed, inject, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../supabase.service';
import { CartService } from '../../services/cart.service';
import { Category, MenuItem, Order } from '../../models/cafe.models';

declare var paypal: any;

@Component({
  selector: 'app-ordering-menu',
  standalone: true,
  imports: [CommonModule],
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
export class OrderingMenuComponent implements OnInit, AfterViewChecked {
  private supabase = inject(SupabaseService);
  public cart = inject(CartService);

  categories = signal<Category[]>([]);
  menuItems = signal<MenuItem[]>([]);
  selectedCategoryId = signal<string | null>(null);
  selectedTable = signal<number | null>(null);
  activeOrder = signal<Order | null>(null);
  showEBill = signal<boolean>(false);
  paypalInitialized = false;

  filteredMenuItems = computed(() => {
    const categoryId = this.selectedCategoryId();
    if (!categoryId) return this.menuItems();
    return this.menuItems().filter(item => item.category_id === categoryId);
  });

  async ngOnInit() {
    const savedTable = localStorage.getItem('selectedTable');
    if (savedTable) {
      this.selectedTable.set(parseInt(savedTable));
    }

    const { data: catData } = await this.supabase.getCategories();
    this.categories.set(catData || []);

    const { data: menuData } = await this.supabase.getMenuItems();
    this.menuItems.set(menuData || []);

    this.setupOrderSubscription();
  }

  ngAfterViewChecked() {
    const isServed = this.activeOrder()?.status === 'served';
    const isPendingPayment = this.activeOrder()?.payment_status === 'pending';
    
    if (isServed && isPendingPayment && !this.paypalInitialized) {
      const element = document.getElementById('paypal-button-container');
      if (element && typeof paypal !== 'undefined') {
        this.initPayPal();
      }
    }
  }

  setupOrderSubscription() {
    this.supabase.subscribeToOrders(async (payload) => {
      const current = this.activeOrder();
      if (current && payload.new && payload.new.id === current.id) {
        const prevStatus = current.payment_status;
        // Re-fetch full order with items
        const { data } = await this.supabase.getOrderById(current.id);
        if (data) {
          // Reset paypal init if status just became served
          if (data.status === 'served' && current.status !== 'served') {
            this.paypalInitialized = false;
          }
          this.activeOrder.set(data);
          
          // Auto-show E-bill when payment is confirmed (e.g. KDS confirmed cash)
          if (data.payment_status === 'completed' && prevStatus !== 'completed') {
            this.showEBill.set(true);
          }
        }
      }
    });
  }

  initPayPal() {
    this.paypalInitialized = true;
    const container = document.getElementById('paypal-button-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear any existing
    
    paypal.Buttons({
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: this.activeOrder()?.total_price.toString()
            }
          }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        const order = await actions.order.capture();
        this.handlePaymentSuccess(order.id);
      },
      onError: (err: any) => {
        console.error('PayPal Error:', err);
        this.paypalInitialized = false;
      }
    }).render('#paypal-button-container');
  }

  async handlePaymentSuccess(paymentId: string, paymentMode: 'paypal' | 'cash' = 'paypal') {
    const current = this.activeOrder();
    if (current) {
      const { error } = await this.supabase.client
        .from('orders')
        .update({ 
          payment_status: 'completed',
          payment_id: paymentId,
          payment_mode: paymentMode
        })
        .eq('id', current.id);
      
      if (!error) {
        // Fetch again to get updated state for E-Bill
        const { data } = await this.supabase.getOrderById(current.id);
        if (data) {
          this.activeOrder.set(data);
          this.showEBill.set(true);
        }
      }
    }
  }

  async handleCashPayment() {
    const current = this.activeOrder();
    if (!current) return;
    
    if (confirm('Please proceed to the counter to pay in cash.\nThe staff will confirm payment on their end.\n\nClick OK to notify staff.')) {
      // Only flag as cash — do NOT complete yet. KDS confirms and completes.
      const { error } = await this.supabase.client
        .from('orders')
        .update({ payment_mode: 'cash' })
        .eq('id', current.id);

      if (!error) {
        // Re-fetch so the UI switches to "Awaiting Cash Confirmation" spinner
        const { data } = await this.supabase.getOrderById(current.id);
        if (data) this.activeOrder.set(data);
      } else {
        console.error('Failed to flag cash payment:', error);
        alert('Something went wrong. Please try again.');
      }
    }
  }

  // Fallback for testing or if PayPal is blocked
  async handleManualPayment() {
    if (confirm('Confirm simulated payment for testing?')) {
      await this.handlePaymentSuccess('SIM-PAY-' + Math.random().toString(36).substring(7).toUpperCase(), 'paypal');
    }
  }

  selectTable(n: number) {
    this.selectedTable.set(n);
    localStorage.setItem('selectedTable', n.toString());
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
    
    if (items.length === 0 || !table) return;

    const order: Partial<Order> = {
      customer_name: 'Guest',
      table_number: table,
      total_price: this.cart.totalPrice(),
      status: 'pending',
      payment_status: 'pending'
    };

    const result = await this.supabase.createOrder(order, items);
    if (!result.error && 'data' in result && result.data) {
      this.activeOrder.set(result.data as Order);
      this.cart.clearCart();
    } else {
      console.error('Error placing order:', result.error);
      alert('Failed to place order.');
    }
  }

  closeEBill() {
    this.showEBill.set(false);
    this.activeOrder.set(null);
    this.paypalInitialized = false;
  }
}
