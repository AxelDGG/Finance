// Empaqueta cada Edge Function con la lógica de packages/core en un solo
// archivo listo para publicar en Supabase:
//   node scripts/build-functions.mjs
// Resultado: supabase/functions/<nombre>/dist/index.js
import { build } from 'esbuild';
import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const carpeta = join(raiz, 'supabase', 'functions');

for (const nombre of readdirSync(carpeta)) {
  const entrada = join(carpeta, nombre, 'index.ts');
  if (!existsSync(entrada)) continue;
  await build({
    entryPoints: [entrada],
    outfile: join(carpeta, nombre, 'dist', 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    external: ['npm:*', 'jsr:*', 'node:*'],
    legalComments: 'none',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: true,
    charset: 'ascii',
    banner: { js: `// Generado por scripts/build-functions.mjs (no editar a mano).` },
  });
  // esbuild no escapa los acentos dentro de expresiones regulares; los
  // convertimos a \uXXXX para que el archivo sea ASCII puro.
  const salida = join(carpeta, nombre, 'dist', 'index.js');
  const texto = readFileSync(salida, 'utf8').replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  writeFileSync(salida, texto);
  console.log(`✓ ${nombre}`);
}
