import { Injectable, signal } from '@angular/core';

export type DialogTone = 'default' | 'danger';
export type DialogType = 'confirm' | 'alert';

export interface DialogState {
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  tone: DialogTone;
}

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private readonly state = signal<DialogState | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  readonly dialog = this.state.asReadonly();

  confirm(config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: DialogTone;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.state.set({
        type: 'confirm',
        title: config.title,
        message: config.message,
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        tone: config.tone || 'default',
      });
    });
  }

  alert(config: {
    title: string;
    message: string;
    confirmText?: string;
    tone?: DialogTone;
  }): Promise<void> {
    return new Promise((resolve) => {
      this.resolver = () => resolve();
      this.state.set({
        type: 'alert',
        title: config.title,
        message: config.message,
        confirmText: config.confirmText || 'OK',
        tone: config.tone || 'default',
      });
    });
  }

  close(result: boolean) {
    const resolve = this.resolver;
    this.resolver = null;
    this.state.set(null);
    resolve?.(result);
  }
}

