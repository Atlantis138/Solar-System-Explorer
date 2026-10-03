import { readFileSync } from 'node:fs';
import ts from 'typescript';
const urls = new Map();
function compile(url) {
  if (urls.has(url.href)) return urls.get(url.href);
  let js = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  js = js.replace(/from ['"](\.[^'"]+)['"]/g, (_, specifier) => {
    const dependency = new URL(specifier.endsWith('.ts') ? specifier : specifier + '.ts', url);
    return `from '${compile(dependency)}'`;
  });
  const data = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  urls.set(url.href, data);
  return data;
}
export const importTs = url => import(compile(url));
