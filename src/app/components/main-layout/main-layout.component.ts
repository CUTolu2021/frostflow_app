import { Component, inject, OnDestroy, Injector, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationStart } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent {
  isMobileMenuOpen = false;
  private router = inject(Router);

  constructor(private injector: Injector) {
    const routerEvent = toSignal(this.router.events, { injector: this.injector });

    effect(() => {
      const event = routerEvent();
      if (event instanceof NavigationStart) {
        this.closeMobileMenu();
      }
    }, { injector: this.injector });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

}
