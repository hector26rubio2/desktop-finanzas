# Elimina la Tarea Programada del Monitor del Orquestador.
# Uso:  pwsh -File .\scripts\autostart-remove.ps1
$ErrorActionPreference = "Stop"
$TaskName = "FinanzasMonitor"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host "  La tarea '$TaskName' no existe (nada que quitar)."
  return
}
try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "  OK  Tarea '$TaskName' eliminada."
