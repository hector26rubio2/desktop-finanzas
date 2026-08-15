import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

export type SkeletonVariant = 'kpis' | 'table' | 'cards' | 'chart' | 'block';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.css',
})
export class SkeletonComponent {
  variant = input<SkeletonVariant>('block');

  count = input(4);

  label = input('');

  readonly announces = computed(() => this.label().length > 0);

  height = input(78);

  readonly pieces = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i));
}
