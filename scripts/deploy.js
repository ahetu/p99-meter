const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const outDir = path.resolve(__dirname, '..', 'out');
const srcDir = path.join(outDir, 'p99-meter');
const eqDir = path.resolve(__dirname, '..', '..', '..');
const destDir = path.join(eqDir, 'p99-meter');

if (!fs.existsSync(srcDir)) {
  console.error(`Build output not found: ${srcDir}`);
  console.error('Run "npm run dist" first.');
  process.exit(1);
}

if (!fs.existsSync(path.join(eqDir, 'Logs'))) {
  console.error(`EQ directory not found at: ${eqDir}`);
  console.error('Expected to find Logs/ in the EQ root.');
  process.exit(1);
}

console.log(`Deploying packaged app to: ${destDir}`);
try {
  execSync(
    `robocopy "${srcDir}" "${destDir}" /E /MIR /NFL /NDL /NJH /NJS /NP`,
    { stdio: 'inherit', shell: true }
  );
} catch (err) {
  // Robocopy exit codes 0-7 are success (1 = files copied, 2 = extras detected, etc.)
  if (err.status >= 8) {
    console.error(`robocopy failed with exit code ${err.status}`);
    process.exit(1);
  }
}

console.log(`\nDeployed to ${destDir}`);
console.log(`Run p99-meter.exe from there, or use "Launch EverQuest.bat"`);
