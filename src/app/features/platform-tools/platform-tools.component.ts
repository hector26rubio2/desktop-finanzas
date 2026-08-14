import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalDataRepository } from '../../shared/services/local/local-data.repository';
import { PlatformService } from '../../shared/services/platform.service';
import {
  extractMovementRows,
  parseMovementCsv,
  prepareMovementImport,
  type MovementImportPreview,
} from './movement-import';
import { auditLocalData, type LocalDataAuditReport } from './local-data-audit';
import { planLocalDataRepair, type LocalRepairPlan } from './local-data-repair';
@Component({
  selector: 'app-platform-tools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-tools.component.html',
  styleUrl: './platform-tools.component.css',
})
export class PlatformToolsComponent {
  local = inject(LocalDataRepository);
  platform = inject(PlatformService);
  preview = signal<MovementImportPreview | null>(null);
  auditReport = signal<LocalDataAuditReport | null>(null);
  repairPlan = signal<LocalRepairPlan | null>(null);
  importing = signal(false);
  auditing = signal(false);
  repairing = signal(false);
  message = signal('');
  backupPath = '';
  restorePath = '';
  restoreRevision = '';
  metrics = signal<Record<string, unknown> | null>(null);
  pendingRows: unknown[] | null = null;
  importFormat: 'json' | 'csv' = 'json';
  constructor() {
    void this.platform.refreshCapabilities();
    void this.loadMetrics();
  }
  private async loadMetrics() {
    const [movements, accounts, loans] = await Promise.all([
      this.local.list<unknown>('movement'),
      this.local.list<unknown>('account'),
      this.local.list<unknown>('loan'),
    ]);
    this.metrics.set({
      source: 'SQLite local cifrado',
      movements: movements.length,
      accounts: accounts.length,
      loans: loans.length,
    });
  }
  async export() {
    const data = await this.local.list<unknown>('movement');
    this.downloadJson(data, `finanzas-movements-${new Date().toISOString().slice(0, 10)}.json`);
  }
  async choose(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    this.importFormat = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
    try {
      this.pendingRows = this.importFormat === 'csv' ? parseMovementCsv(text) : extractMovementRows(JSON.parse(text));
    } catch {
      this.pendingRows = null;
      this.preview.set(null);
      this.message.set(`El archivo ${this.importFormat.toUpperCase()} no se pudo interpretar.`);
      return;
    }
    await this.validate(false);
  }
  async validate(apply: boolean) {
    if (this.pendingRows === null || this.importing()) return;
    try {
      const existing = await this.local.list<unknown>('movement');
      const result = await prepareMovementImport(this.pendingRows, existing);
      this.preview.set(result);

      if (!apply) {
        this.message.set('Vista previa lista. No se modificaron datos.');
        return;
      }
      if (result.invalid > 0) {
        this.message.set('Corrige las filas inválidas antes de aplicar la importación.');
        return;
      }
      if (result.newCount === 0) {
        this.message.set(`No hay movimientos nuevos; ${result.alreadyApplied} ya estaban aplicados.`);
        return;
      }

      this.importing.set(true);
      const applied = result.newCount;
      await this.local.putMany('movement', result.newMovements, 'import');
      this.auditReport.set(null);
      await this.loadMetrics();
      this.preview.set(await prepareMovementImport(this.pendingRows, [...existing, ...result.newMovements]));
      this.message.set(
        `Importación aplicada en un único lote: ${applied} nuevos; ${result.alreadyApplied} ya existían.`,
      );
    } catch {
      this.message.set('La importación no se aplicó. El lote local fue rechazado sin confirmar cambios.');
    } finally {
      this.importing.set(false);
    }
  }
  async backup() {
    const result = await this.local.backup(this.backupPath || undefined);
    this.backupPath = result.path;
    this.message.set(`Backup cifrado creado. Revisión ${result.revision || 'vacía'}`);
  }
  async inspectRestore() {
    const x = await this.local.backupPreview(this.restorePath);
    this.restoreRevision = x.currentRevision;
    this.message.set(
      `Backup ${x.backupRevision || 'vacío'}; actual ${x.currentRevision || 'vacío'}. Confirma para reemplazar.`,
    );
  }
  async restore() {
    if (!this.restoreRevision) return;
    await this.local.restore(this.restorePath, this.restoreRevision);
    this.auditReport.set(null);
    this.message.set('Restauración local validada. Reinicia la aplicación para recargar todos los informes.');
  }

  async runAudit() {
    if (this.auditing()) return;
    this.auditing.set(true);
    try {
      const [movements, accounts, categories, loans, installmentPurchases] = await Promise.all([
        this.local.list<unknown>('movement'),
        this.local.list<unknown>('account'),
        this.local.list<unknown>('category'),
        this.local.list<unknown>('loan'),
        this.local.list<unknown>('installmentpurchase'),
      ]);
      const scanned = { movements, accounts, categories, loans, installmentPurchases };
      const report = auditLocalData(scanned);
      this.auditReport.set(report);
      this.repairPlan.set(report.summary.total === 0 ? null : planLocalDataRepair(report, scanned));
      this.message.set(
        report.summary.total === 0
          ? 'Auditoría local terminada sin hallazgos. El escaneo fue de solo lectura.'
          : `Auditoría local terminada: ${report.summary.total} hallazgos (${report.summary.critical} críticos, ${report.summary.error} errores, ${report.summary.warning} advertencias). No se modificaron datos.`,
      );
    } catch {
      this.message.set('No fue posible completar la auditoría local. No se modificaron datos.');
    } finally {
      this.auditing.set(false);
    }
  }

  /**
   * Aplica solo los cambios que el plan declaró deducibles, en un único lote.
   * Los que requieren decisión quedan intactos y siguen listados: si esta
   * función los tocara, estaría corrigiendo información ambigua en silencio.
   */
  async applyRepair() {
    const plan = this.repairPlan();
    if (this.repairing() || !plan || plan.operations.length === 0) return;
    this.repairing.set(true);
    try {
      await this.local.batch(plan.operations);
      this.message.set(
        `Reparación aplicada en un único lote: ${plan.summary.repairable} corregido(s). `
        + `${plan.summary.requiresDecision} caso(s) siguen esperando tu decisión y no se tocaron.`,
      );
      // El informe anterior ya no describe el estado del disco.
      this.auditReport.set(null);
      this.repairPlan.set(null);
      await this.loadMetrics();
    } catch {
      this.message.set('La reparación no se aplicó. El lote local fue rechazado sin confirmar cambios.');
    } finally {
      this.repairing.set(false);
    }
  }

  exportRepairPlan() {
    const plan = this.repairPlan();
    if (!plan) return;
    this.downloadJson(
      { ...plan, exportedAt: new Date().toISOString() },
      `finanzas-repair-plan-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  exportAudit() {
    const report = this.auditReport();
    if (!report) return;
    this.downloadJson(
      { ...report, exportedAt: new Date().toISOString() },
      `finanzas-integrity-audit-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  private downloadJson(value: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
