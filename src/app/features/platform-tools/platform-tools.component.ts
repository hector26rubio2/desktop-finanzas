import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalDataRepository } from '../../shared/services/local/local-data.repository';
import { PlatformService } from '../../shared/services/platform.service';
import { I18nService } from '../../shared/i18n/i18n.service';
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
  private i18n = inject(I18nService);
  readonly tr = (es: string, en: string, pt: string) => this.i18n.localize(es, en, pt);
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
    void this.loadMetrics();
  }
  private async loadMetrics() {
    const [movements, accounts, loans] = await Promise.all([
      this.local.list<unknown>('movement'),
      this.local.list<unknown>('account'),
      this.local.list<unknown>('loan'),
    ]);
    this.metrics.set({
      source: this.tr(
        'SQLite local en este dispositivo',
        'Local SQLite on this device',
        'SQLite local neste dispositivo',
      ),
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
      this.message.set(
        this.tr(
          `El archivo ${this.importFormat.toUpperCase()} no se pudo interpretar.`,
          `The ${this.importFormat.toUpperCase()} file could not be parsed.`,
          `Não foi possível interpretar o arquivo ${this.importFormat.toUpperCase()}.`,
        ),
      );
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
        this.message.set(
          this.tr(
            'Vista previa lista. No se modificaron datos.',
            'Preview ready. No data was changed.',
            'Prévia pronta. Nenhum dado foi alterado.',
          ),
        );
        return;
      }
      if (result.invalid > 0) {
        this.message.set(
          this.tr(
            'Corrige las filas inválidas antes de aplicar la importación.',
            'Fix invalid rows before applying the import.',
            'Corrija as linhas inválidas antes de aplicar a importação.',
          ),
        );
        return;
      }
      if (result.newCount === 0) {
        this.message.set(
          this.tr(
            `No hay movimientos nuevos; ${result.alreadyApplied} ya estaban aplicados.`,
            `There are no new movements; ${result.alreadyApplied} were already applied.`,
            `Não há novos movimentos; ${result.alreadyApplied} já foram aplicados.`,
          ),
        );
        return;
      }

      this.importing.set(true);
      const applied = result.newCount;
      await this.local.putMany('movement', result.newMovements, 'import');
      this.auditReport.set(null);
      await this.loadMetrics();
      this.preview.set(await prepareMovementImport(this.pendingRows, [...existing, ...result.newMovements]));
      this.message.set(
        this.tr(
          `Importación aplicada en un único lote: ${applied} nuevos; ${result.alreadyApplied} ya existían.`,
          `Import applied in one batch: ${applied} new; ${result.alreadyApplied} already existed.`,
          `Importação aplicada em um único lote: ${applied} novos; ${result.alreadyApplied} já existiam.`,
        ),
      );
    } catch {
      this.message.set(
        this.tr(
          'La importación no se aplicó. El lote local fue rechazado sin confirmar cambios.',
          'The import was not applied. The local batch was rejected without committing changes.',
          'A importação não foi aplicada. O lote local foi rejeitado sem confirmar alterações.',
        ),
      );
    } finally {
      this.importing.set(false);
    }
  }
  async backup() {
    try {
      const result = await this.local.backup(this.backupPath || undefined);
      this.backupPath = result.path;
      this.message.set(
        this.tr(
          `Backup cifrado creado. Revisión ${result.revision}.`,
          `Encrypted backup created. Revision ${result.revision}.`,
          `Backup criptografado criado. Revisão ${result.revision}.`,
        ),
      );
    } catch (error) {
      this.message.set(
        this.userMessage(
          error,
          this.tr(
            'No fue posible crear el backup.',
            'The backup could not be created.',
            'Não foi possível criar o backup.',
          ),
        ),
      );
    }
  }
  async chooseBackupDestination() {
    const path = await window.electronAPI?.dialogs?.chooseBackupDestination();
    if (path) this.backupPath = path;
  }
  async chooseRestoreSource() {
    const path = await window.electronAPI?.dialogs?.chooseBackupSource();
    if (path) {
      this.restorePath = path;
      this.restoreRevision = '';
    }
  }
  async inspectRestore() {
    try {
      const x = await this.local.backupPreview(this.restorePath);
      this.restoreRevision = x.currentRevision;
      const kind = x.encrypted
        ? this.tr('cifrado', 'encrypted', 'criptografado')
        : this.tr('antiguo sin cifrar', 'legacy unencrypted', 'antigo sem criptografia');
      this.message.set(
        this.tr(
          `Backup ${kind} validado. Confirma para reemplazar los datos actuales.`,
          `${kind} backup validated. Confirm to replace the current data.`,
          `Backup ${kind} validado. Confirme para substituir os dados atuais.`,
        ),
      );
    } catch (error) {
      this.restoreRevision = '';
      this.message.set(
        this.userMessage(
          error,
          this.tr(
            'El backup no es válido o pertenece a otra instalación.',
            'The backup is invalid or belongs to another installation.',
            'O backup é inválido ou pertence a outra instalação.',
          ),
        ),
      );
    }
  }
  async restore() {
    if (!this.restoreRevision) return;
    try {
      await this.local.restore(this.restorePath, this.restoreRevision);
      this.restoreRevision = '';
      this.auditReport.set(null);
      await this.loadMetrics();
      this.message.set(
        this.tr(
          'Restauración completada y validada.',
          'Restore completed and validated.',
          'Restauração concluída e validada.',
        ),
      );
    } catch (error) {
      this.restoreRevision = '';
      this.message.set(
        this.userMessage(
          error,
          this.tr(
            'No fue posible restaurar el backup; los datos actuales se conservaron.',
            'The backup could not be restored; current data was preserved.',
            'Não foi possível restaurar o backup; os dados atuais foram preservados.',
          ),
        ),
      );
    }
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
          ? this.tr(
              'Auditoría local terminada sin hallazgos. El escaneo fue de solo lectura.',
              'Local audit completed with no findings. The scan was read-only.',
              'Auditoria local concluída sem achados. A verificação foi somente leitura.',
            )
          : this.tr(
              `Auditoría local terminada: ${report.summary.total} hallazgos (${report.summary.critical} críticos, ${report.summary.error} errores, ${report.summary.warning} advertencias). No se modificaron datos.`,
              `Local audit completed: ${report.summary.total} findings (${report.summary.critical} critical, ${report.summary.error} errors, ${report.summary.warning} warnings). No data was changed.`,
              `Auditoria local concluída: ${report.summary.total} achados (${report.summary.critical} críticos, ${report.summary.error} erros, ${report.summary.warning} avisos). Nenhum dado foi alterado.`,
            ),
      );
    } catch {
      this.message.set(
        this.tr(
          'No fue posible completar la auditoría local. No se modificaron datos.',
          'The local audit could not be completed. No data was changed.',
          'Não foi possível concluir a auditoria local. Nenhum dado foi alterado.',
        ),
      );
    } finally {
      this.auditing.set(false);
    }
  }

  async applyRepair() {
    const plan = this.repairPlan();
    if (this.repairing() || !plan || plan.operations.length === 0) return;
    this.repairing.set(true);
    try {
      await this.local.batch(plan.operations);
      this.message.set(
        this.tr(
          `Reparación aplicada en un único lote: ${plan.summary.repairable} corregido(s). ${plan.summary.requiresDecision} caso(s) siguen esperando tu decisión y no se tocaron.`,
          `Repair applied in one batch: ${plan.summary.repairable} corrected. ${plan.summary.requiresDecision} cases still require your decision and were not changed.`,
          `Reparo aplicado em um único lote: ${plan.summary.repairable} corrigido(s). ${plan.summary.requiresDecision} casos ainda exigem sua decisão e não foram alterados.`,
        ),
      );

      this.auditReport.set(null);
      this.repairPlan.set(null);
      await this.loadMetrics();
    } catch {
      this.message.set(
        this.tr(
          'La reparación no se aplicó. El lote local fue rechazado sin confirmar cambios.',
          'The repair was not applied. The local batch was rejected without committing changes.',
          'O reparo não foi aplicado. O lote local foi rejeitado sem confirmar alterações.',
        ),
      );
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

  private userMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('backup_destination_exists'))
      return this.tr(
        'El destino ya existe. Elige otro nombre para no sobrescribirlo.',
        'The destination already exists. Choose another name to avoid overwriting it.',
        'O destino já existe. Escolha outro nome para não sobrescrevê-lo.',
      );
    if (message.includes('stale_restore'))
      return this.tr(
        'Los datos cambiaron después de la vista previa. Valida el backup otra vez.',
        'The data changed after the preview. Validate the backup again.',
        'Os dados mudaram após a prévia. Valide o backup novamente.',
      );
    return fallback;
  }
}
