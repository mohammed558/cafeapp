import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase.service';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase = inject(SupabaseService);
  currentUser = signal<User | null>(null);

  constructor() {
    this.supabase.client.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      this.currentUser.set(session?.user ?? null);
    });

    this.supabase.client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  async signInWithEmail(email: string) {
    return await this.supabase.client.auth.signInWithOtp({
      email: email,
    });
  }

  async verifyOtp(email: string, token: string) {
    return await this.supabase.client.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email',
    });
  }

  async signOut() {
    return await this.supabase.client.auth.signOut();
  }

  get isAuthenticated() {
    return !!this.currentUser();
  }
}
