/** Transform a logic.js ES module into a function body that returns `register` (no imports allowed). */
export function transformLogicSource(src: string): string {
  if (/^\s*import\s[^(]/m.test(src)) throw new Error('logic.js must not contain import statements');
  if (!/export\s+default/.test(src)) throw new Error('logic.js must `export default function register(sdk) { … }`');
  return src.replace(/export\s+default\s+/, 'const __kodigo_register = ') + '\n;return __kodigo_register;';
}
