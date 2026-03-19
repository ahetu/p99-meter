import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import * as path from 'path';
import * as fs from 'fs';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: false,
    name: 'p99-meter',
    executableName: 'p99-meter',
  },
  rebuildConfig: {},
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Copy externalized native modules into the packaged app's node_modules
      const nativeModules = ['electron-overlay-window'];
      const srcNodeModules = path.resolve(__dirname, 'node_modules');
      const destNodeModules = path.join(buildPath, 'node_modules');

      for (const mod of nativeModules) {
        const src = path.join(srcNodeModules, mod);
        const dest = path.join(destNodeModules, mod);
        if (fs.existsSync(src)) {
          console.log(`[forge hook] Copying native module: ${mod}`);
          copyDirSync(src, dest);

          // Also copy any transitive native dependencies
          const modPkg = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf-8'));
          const deps = Object.keys(modPkg.dependencies || {});
          for (const dep of deps) {
            const depSrc = path.join(srcNodeModules, dep);
            const depDest = path.join(destNodeModules, dep);
            if (fs.existsSync(depSrc) && !fs.existsSync(depDest)) {
              console.log(`[forge hook]   + transitive dep: ${dep}`);
              copyDirSync(depSrc, depDest);
            }
          }
        } else {
          console.warn(`[forge hook] WARNING: native module not found: ${src}`);
        }
      }
    },
    postPackage: async (_config, result) => {
      const outDir = result.outputPaths[0];
      for (const file of ['Setup.bat', 'Launch EverQuest.bat']) {
        const src = path.join(__dirname, file);
        const dest = path.join(outDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[forge hook] Copied ${file} into package`);
        } else {
          console.warn(`[forge hook] WARNING: ${file} not found at ${src}`);
        }
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: 'p99_meter',
      setupExe: 'p99-meter-setup.exe',
    }),
    new MakerZIP({}, ['win32']),
  ],
  plugins: [
    new WebpackPlugin({
      devServer: { port: 3456 },
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
          {
            html: './src/tooltip.html',
            js: './src/tooltipRenderer.tsx',
            name: 'tooltip_window',
            preload: {
              js: './src/tooltipPreload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
};

export default config;
