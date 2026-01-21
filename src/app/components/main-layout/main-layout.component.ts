import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationStart } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css'
})
export class MainLayoutComponent implements OnDestroy {
  isMobileMenuOpen = false;
  private router = inject(Router);
  private navSub: Subscription;

  constructor() {
    this.navSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.closeMobileMenu();
      }
    });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  ngOnDestroy() {
    if (this.navSub) {
      this.navSub.unsubscribe();
    }
  }
}
