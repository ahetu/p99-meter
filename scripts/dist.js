const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pkg = require('../package.json');
const version = pkg.version;
const outDir = path.resolve(__dirname, '..', 'out');
const srcDir = path.join(outDir, 'p99-meter-win32-x64');
const destDir = path.join(outDir, 'p99-meter');
const zipFile = path.join(outDir, `p99-meter-v${version}.zip`);

if (!fs.existsSync(srcDir)) {
  console.error(`Build output not found: ${srcDir}`);
  console.error('Run "npm run package" first.');
  process.exit(1);
}

// Clean previous dist artifacts
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true });
  console.log(`Removed old p99-meter/`);
}
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
  console.log(`Removed old ${path.basename(zipFile)}`);
}

// Rename to clean folder name (no platform/arch suffix)
fs.renameSync(srcDir, destDir);
console.log(`Renamed p99-meter-win32-x64/ -> p99-meter/`);

// Create distributable ZIP using PowerShell
console.log('Creating ZIP...');
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${destDir}' -DestinationPath '${zipFile}'"`,
  { stdio: 'inherit' }
);

console.log(`\nDone! Distribution ready: out\\${path.basename(zipFile)}`);
console.log(`Users extract the p99-meter folder into their EverQuest directory and run Setup.bat`);
