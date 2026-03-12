import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[200] flex items-center justify-center bg-background-dark/90 backdrop-blur-xl p-4 animate-in fade-in duration-500">
      <div class="w-full max-w-[400px] bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 transform transition-all animate-in zoom-in-95 duration-300">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center size-16 rounded-2xl bg-primary text-white mb-4 shadow-lg shadow-primary/30 rotate-3">
            <span class="material-symbols-outlined text-3xl">mail</span>
          </div>
          <h2 class="text-2xl font-black text-slate-900 dark:text-white mb-2">Welcome Back</h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {{ step() === 'email' ? 'Enter your email to login or signup' : 'Enter the 6-digit code sent to your email' }}
          </p>
        </div>

        <!-- Email Step -->
        <div *ngIf="step() === 'email'" class="space-y-6">
          <div class="relative">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute left-4 -top-2 bg-white dark:bg-slate-900 px-2 z-10">Email Address</label>
            <input type="email" [(ngModel)]="email" 
                   placeholder="your@email.com"
                   class="w-full h-16 px-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-bold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none">
          </div>
          <button (click)="sendOtp()" 
                  [disabled]="loading()"
                  class="w-full h-16 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
            <span *ngIf="loading()" class="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ loading() ? 'Sending...' : 'Send OTP' }}
            <span *ngIf="!loading()" class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>

        <!-- OTP Step -->
        <div *ngIf="step() === 'otp'" class="space-y-6">
          <div class="relative">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 absolute left-4 -top-2 bg-white dark:bg-slate-900 px-2 z-10">Verification Code</label>
            <input type="text" [(ngModel)]="otp" 
                   placeholder="123456"
                   maxlength="8"
                   class="w-full h-16 px-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-center text-3xl font-black tracking-[0.3em] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none">
          </div>
          <div class="flex flex-col gap-3">
            <button (click)="verifyOtp()" 
                    [disabled]="loading()"
                    class="w-full h-16 bg-green-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-green-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
              <span *ngIf="loading()" class="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ loading() ? 'Verifying...' : 'Verify & Login' }}
              <span *ngIf="!loading()" class="material-symbols-outlined">verified</span>
            </button>
            <button (click)="step.set('email')" class="text-xs font-bold text-slate-400 hover:text-primary transition-colors py-2">
              Edit Email Address
            </button>
          </div>
        </div>

        <button (click)="onClose()" class="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class AuthComponent {
  private auth = inject(AuthService);
  
  email = '';
  otp = '';
  step = signal<'email' | 'otp'>('email');
  loading = signal(false);

  close = signal(false); // Used to output close event effectively

  async sendOtp() {
    if (!this.email) return alert('Please enter email');
    this.loading.set(true);
    const { error } = await this.auth.signInWithEmail(this.email);
    this.loading.set(false);
    
    if (error) {
      alert(error.message);
    } else {
      this.step.set('otp');
    }
  }

  async verifyOtp() {
    if (!this.otp) return alert('Please enter OTP');
    this.loading.set(true);
    const { error } = await this.auth.verifyOtp(this.email, this.otp);
    this.loading.set(false);

    if (error) {
      alert(error.message);
    } else {
      this.onClose();
    }
  }

  onClose() {
    // This will be handled by the parent component by hiding this component via *ngIf
    // We can use an Output but for simplicity in this standalone prompt we'll just handle it in parent
    (window as any).closeAuthModal?.();
  }
}
