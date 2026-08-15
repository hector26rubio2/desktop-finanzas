import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

/**
 * Marca de carga con la forma de lo que va a llegar. Existe como componente
 * —y no como divs sueltos en cada plantilla, que es como estaba en el
 * dashboard— porque cada pantalla lo escribía a mano o directamente ponía un
 * «Cargando…» en texto: el salto de layout al llegar los datos era distinto en
 * cada vista.
 *
 * Es una región `status` viva: quien usa lector de pantalla oye que se está
 * cargando en vez de encontrarse una zona muda.
 */
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
  /** Cuántas piezas pintar. Se ignora en 'chart', que tiene forma fija. */
  count = input(4);
  /**
   * Texto que anuncia el lector de pantalla mientras dura la carga. Vacío
   * convierte el bloque en decoración: una pantalla que apila varios
   * esqueletos solo debe anunciar una vez, no tres.
   */
  label = input('');

  readonly announces = computed(() => this.label().length > 0);
  /** Alto en píxeles de cada pieza en la variante 'block'. */
  height = input(78);

  readonly pieces = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i));
}
