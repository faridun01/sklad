const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const appName = process.env.SKLAD_EXE_NAME || process.env.PHARMAPRO_EXE_NAME || 'Sklad.exe';
const appPath = path.join(process.cwd(), 'release', 'win-unpacked', appName);

if (!fs.existsSync(appPath)) {
  console.error(`[launch-built] Executable not found: ${appPath}`);
  process.exit(1);
}

const child = spawn(appPath, [], {
  detached: true,
  stdio: 'ignore',
  windowsHide: false,
});

child.unref();
console.log(`[launch-built] Started: ${appPath}`);
