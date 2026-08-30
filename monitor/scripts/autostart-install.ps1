# Registra una Tarea Programada de Windows que arranca el Monitor del Orquestador
# automaticamente al iniciar sesion, en ventana oculta.
#
# Uso:  pwsh -File .\scripts\autostart-install.ps1   (o Windows PowerShell)
# Quitar:  .\scripts\autostart-remove.ps1
#
# No suele requerir administrador (tarea del propio usuario). Si Windows lo pide,
# ejecuta esta consola "como administrador".
$ErrorActionPreference = "Stop"
$TaskName   = "FinanzasMonitor"
$MonitorDir = Split-Path $PSScriptRoot -Parent

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  Write-Error "No encuentro 'pnpm' en el PATH. Activa Volta + pnpm y reintenta."
  exit 1
}
$pnpmPath = $pnpm.Source

# Arranca 'pnpm start' dentro de monitor/, sin ventana visible.
$psCmd    = "Set-Location -LiteralPath '$MonitorDir'; & '$pnpmPath' start"
$argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$psCmd`""

$action    = New-ScheduledTaskAction    -Execute "powershell.exe" -Argument $argument -WorkingDirectory $MonitorDir
$trigger   = New-ScheduledTaskTrigger   -AtLogOn -User "$env:USERNAME"
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                                          -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
                                        -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force `
  -Description "Monitor del Orquestador (Finanzas Desktop) en http://proyectos.com" | Out-Null

Write-Host ""
Write-Host "  OK  Tarea '$TaskName' registrada. Arrancara al iniciar sesion."
Write-Host "  Servidor: & '$pnpmPath' start  (cwd: $MonitorDir)"
Write-Host "  Probar ahora:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Quitar:        .\scripts\autostart-remove.ps1"
Write-Host ""
