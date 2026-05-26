import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'button[app-btn]',
  standalone: true,
  templateUrl: './button.component.html',
  styleUrl: './button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"btn btn--" + variant()',
    '[disabled]': 'disabled()',
  },
})
export class ButtonComponent {
  variant = input<'primary' | 'ghost' | 'danger'>('primary');
  disabled = input(false);
  btnClick = output<MouseEvent>();
}
