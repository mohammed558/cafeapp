import { Injectable, signal, computed } from '@angular/core';
import { MenuItem, OrderItem } from '../models/cafe.models';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems = signal<OrderItem[]>([]);

  items = computed(() => this.cartItems());
  
  totalItems = computed(() => 
    this.cartItems().reduce((acc, item) => acc + item.quantity, 0)
  );

  totalPrice = computed(() => 
    this.cartItems().reduce((acc, item) => acc + (item.quantity * item.unit_price), 0)
  );

  addToCart(menuItem: MenuItem) {
    this.cartItems.update(items => {
      const existingItem = items.find(i => i.menu_item_id === menuItem.id);
      if (existingItem) {
        return items.map(i => 
          i.menu_item_id === menuItem.id 
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        );
      }
      return [...items, {
        menu_item_id: menuItem.id,
        quantity: 1,
        unit_price: menuItem.price,
        menu_items: menuItem
      }];
    });
  }

  removeFromCart(menuItemId: string) {
    this.cartItems.update(items => items.filter(i => i.menu_item_id !== menuItemId));
  }

  clearCart() {
    this.cartItems.set([]);
  }
}
