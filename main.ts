// ASHFALL YARD — make.fun threejs-fps-01 entrypoint (Node 22, no dependencies).
//
// Hands the entry in: copies game/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with
// buildDossier from vendor/makefun-threejs.ts. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory is wiped first so a stale file can never leak into
// a submission. The dossier is byte for byte what the scorer rebuilds with
// the same library, so a mismatch here fails loudly instead of at the gate.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(gameDir)) fail(`game/ not found under ${repoRoot}`);
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail(`screenshots/ not found under ${repoRoot}`);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

let dossier: Uint8Array;
try {
  dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
} catch (err) {
  fail(`buildDossier refused the entry: ${err instanceof Error ? err.message : String(err)}`);
}

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`ASHFALL YARD handed in: ${outDir}`);
console.log(`  game/ + screenshots/ copied, dossier.json ${dossier.length} bytes`);
