import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';

import { NodeIO } from '@gltf-transform/core';
import { KHRLightsPunctual } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const LIGHTS_EXT = 'KHR_lights_punctual';

const [,, inRoot, outRoot] = process.argv;
const tempRoot = path.join(process.cwd(), 'temp');

if (!inRoot || !outRoot) {
  console.error('Usage: node clean-dir.mjs <inputDir> <outputDir>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions([KHRLightsPunctual]);

function isGLTFFile(p) {
  const ext = path.extname(p).toLowerCase();
  return ext === '.glb' || ext === '.gltf';
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(full);
    else if (ent.isFile()) yield full;
  }
}

function isEmptyLeaf(node) {
  if (node.listChildren().length > 0) return false;
  if (node.getMesh()) return false;
  if (node.getCamera()) return false;
  if (node.getExtension(LIGHTS_EXT)) return false;
  return true;
}

function detachAndDisposeNode(node, root) {
  const parent = node.getParentNode?.();
  if (parent) {
    parent.removeChild(node);
  } else {
    // node may be a direct child of a Scene
    for (const scene of root.listScenes()) {
      if (scene.listChildren().includes(node)) scene.removeChild(node);
    }
  }
  node.dispose();
}

async function cleanOne(inputPath, outputPath) {
  const doc = await io.read(inputPath);
  const root = doc.getRoot();

  // 1) Detach cameras + punctual lights
  for (const node of root.listNodes()) {
    if (node.getCamera()) node.setCamera(null);
    if (node.getExtension(LIGHTS_EXT)) node.setExtension(LIGHTS_EXT, null);
  }

  // 2) Remove empty leaf nodes bottom-up
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of root.listNodes()) {
      if (node.isDisposed?.()) continue;
      if (!isEmptyLeaf(node)) continue;
      detachAndDisposeNode(node, root);
      changed = true;
    }
  }

  // 3) Prune orphaned resources
  await doc.transform(prune());

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await io.write(outputPath, doc);
  const [, filePath] = outputPath.split(tempRoot);

  // gltfpack applies meshopt and compresses file to the specified output
  exec(`gltfpack -i "${outputPath}" -o "${path.join(outRoot, filePath)}" -tc -cc`, (error, _, stderr) => {
    if (error) {
      console.error(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
  });

  return outputPath;
}

async function main() {
  const inAbs = path.resolve(inRoot);
  const outAbs = path.resolve(tempRoot);

  let total = 0, ok = 0, failed = 0;
  const outputPaths = [];

  for await (const file of walk(inAbs)) {
    if (!isGLTFFile(file)) continue;

    total++;
    const rel = path.relative(inAbs, file);
    const outFile = path.join(outAbs, rel);

    try {
      const outputPath = await cleanOne(file, outFile);
      outputPaths.push(outputPath);
      ok++;
      console.log(`✔ ${rel}`);
    } catch (err) {
      failed++;
      console.error(`✖ ${rel}\n  ${err?.stack || err}`);
    }
  }

  // delete temp files
  for (const file of fs.readdirSync(tempRoot)) {
    fs.rmSync(path.join(tempRoot, file), { recursive: true, force: true });
  }

  console.log(`\nDone. total=${total} ok=${ok} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main();