import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';

@Component({
    selector: 'app-loading',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.css']
})
export class LoadingComponent {
    constructor(public loadingService: LoadingService) { }
}
