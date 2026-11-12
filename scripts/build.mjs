import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function build() {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    write: false,
  });

  const jsCode = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const cssCode = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');

  const html = tpl
    .split('/*__INLINE_CSS__*/')
    .join(cssCode)
    .split('/*__INLINE_JS__*/')
    .join(jsCode);

  const outPath = path.join(root, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');
  const sizeKb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  console.log(`Built self-contained ${outPath} (${sizeKb} KB)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
