import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../shared/i18n/i18n.service';
import { ThemeService } from '../../../shared/services/theme.service';

/**
 * Creador de temas personalizados: borrador de colores más una maqueta que los
 * pinta sin tocar el tema activo.
 *
 * Vive fuera de `settings.component` porque era el bloque más grande de esa
 * pantalla —unos 160 renglones de plantilla y 3,7 kB de CSS— y no comparte
 * estado con el resto de ajustes: solo escribe en ThemeService al guardar.
 * Sacarlo deja la hoja de estilos de ajustes por debajo del presupuesto de
 * 10 kB que el build venía avisando.
 */
@Component({
  selector: 'app-theme-creator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './theme-creator.component.html',
  styleUrl: './theme-creator.component.css',
})
export class ThemeCreatorComponent {
  public i18n = inject(I18nService);
  private theme = inject(ThemeService);

  readonly name = signal('');
  readonly accent = signal('#7c5fb3');
  readonly accent2 = signal('#b68b4a');
  readonly accent3 = signal('#4fa083');
  readonly bg = signal('#f8f8f6');
  readonly isDark = signal(false);

  readonly canSave = computed(() => this.name().trim().length > 0);

  /** Texto con contraste suficiente sobre el fondo elegido. */
  readonly fg = computed(() => (isHexDark(this.bg()) ? '#f4f4f2' : '#1d1b18'));

  readonly line = computed(() => (isHexDark(this.bg()) ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'));

  /** Superficie elevada derivada del fondo. Solo para la maqueta del borrador. */
  readonly surface = computed(() => {
    const toward = isHexDark(this.bg()) ? '#ffffff' : '#000000';
    return `color-mix(in srgb, ${this.bg()} 93%, ${toward})`;
  });

  save() {
    const name = this.name().trim();
    if (!name) return;
    this.theme.saveCustomTheme({
      name,
      isDark: this.isDark(),
      accent: this.accent(),
      accent2: this.accent2(),
      accent3: this.accent3(),
      bg: this.bg(),
    });
    this.name.set('');
  }
}

/** Luminancia percibida (Rec. 709) del hex del selector de color. */
function isHexDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}
