/**
 * Package script for ScreenShare Electron app.
 *
 * Prepares a self-contained build directory with all bundled files,
 * then runs electron-packager to create the Windows .exe.
 *
 * Since esbuild and Vite bundle all dependencies inline, the packaged
 * app only needs the dist/ folder and a minimal package.json.
 */

import { execSync } from 'child_process';
import {
  mkdirSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, resolve } from 'path';

const CLIENT_DIR = resolve(import.meta.dirname ?? '.', '..');
const BUILD_DIR = join(CLIENT_DIR, '.package');
const DIST_DIR = join(CLIENT_DIR, 'dist');

function log(msg) {
  console.log(`[package] ${msg}`);
}

// Step 1: Clean previous package directory
log('Cleaning .package directory...');
if (existsSync(BUILD_DIR)) {
  rmSync(BUILD_DIR, { recursive: true, force: true });
}
mkdirSync(BUILD_DIR, { recursive: true });

// Step 2: Copy dist directory (renderer + main + preload, all self-contained)
log('Copying dist/ to .package/dist/...');
copyDirRecursive(DIST_DIR, join(BUILD_DIR, 'dist'));

// Step 3: Create minimal package.json (no dependencies needed - everything is bundled)
log('Creating minimal package.json...');
const minimalPkg = {
  name: 'screenshare',
  version: '0.1.0',
  type: 'module',
  main: 'dist/main/index.js',
  description: 'Share your screen with friends in real time',
  author: 'ScreenShare',
};
writeFileSync(join(BUILD_DIR, 'package.json'), JSON.stringify(minimalPkg, null, 2));

// Step 4: Run electron-packager on the prepared directory
log('Running electron-packager...');
const packagerCmd = [
  'npx',
  '@electron/packager',
  '.package',
  'ScreenShare',
  '--platform=win32',
  '--arch=x64',
  '--out=release',
  '--overwrite',
  '--electron-version=31.7.7',
].join(' ');

execSync(packagerCmd, {
  cwd: CLIENT_DIR,
  stdio: 'inherit',
});

// Step 5: Clean up
log('Cleaning up .package directory...');
rmSync(BUILD_DIR, { recursive: true, force: true });

log('Done! Check client/release/ for the packaged app.');

/**
 * Recursively copy a directory.
 */
function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
