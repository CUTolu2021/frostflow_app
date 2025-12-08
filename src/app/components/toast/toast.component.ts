import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toastService.toasts$ | async" 
           class="toast" 
           [ngClass]="toast.type"
           (click)="toastService.remove(toast.id)">
        {{ toast.message }}
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999; /* Always on top */
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toast {
      padding: 15px 25px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      min-width: 250px;
    }
    .success { background-color: #10b981; } /* Green */
    .error   { background-color: #ef4444; } /* Red */
    .info    { background-color: #3b82f6; } /* Blue */
    .login   { background-color: #6366f1; } /* Indigo */
    .logout  { background-color: #f59e0b; } /* Amber */

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}
}