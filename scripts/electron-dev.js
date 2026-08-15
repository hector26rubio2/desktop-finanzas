const { spawn, execSync } = require('child_process');
const http = require('http');
const electronBin = require('electron');

try { execSync('taskkill /f /fi "PID ne 0" /im node.exe 2>nul', { stdio: 'ignore' }); } catch {  }

const ng = spawn('ng', ['serve'], { shell: true, stdio: 'inherit' });

ng.on('error', (err) => { console.error('[dev] ng serve failed:', err); process.exit(1); });
ng.on('exit', (code) => { console.error(`[dev] ng serve exited with code ${code}`); });

function poll(retries) {
  if (retries <= 0) { console.error('[dev] TIMEOUT waiting for Angular on http://localhost:4200'); process.exit(1); }
  http.get('http://localhost:4200', () => {
    console.log('[dev] Angular ready — launching Electron');
    const el = spawn(electronBin, ['.', '--dev'], { stdio: 'inherit' });
    el.on('close', (code) => { ng.kill(); process.exit(code ?? 0); });
  }).on('error', () => {
    process.stdout.write('.');
    setTimeout(() => poll(retries - 1), 2000);
  });
}

console.log('[dev] Waiting for Angular dev server on http://localhost:4200...');
poll(120);

process.on('SIGINT', () => { ng.kill(); process.exit(0); });
