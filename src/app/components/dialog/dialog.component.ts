import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  constructor(public dialogService: DialogService) {}

  cancel() {
    this.dialogService.close(false);
  }

  confirm() {
    this.dialogService.close(true);
  }
}

