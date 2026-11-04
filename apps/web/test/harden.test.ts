/**
 * Property 5 (S3): after hardening, every blocked global reads undefined, or hardening throws so no module
 * code runs. Counterexample on the pre-fix assignment loop: a setter-less prototype accessor such as
 * `indexedDB` on WorkerGlobalScope.prototype stayed defined after `self.indexedDB = undefined`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BLOCKED, hardenWorkerGlobal } from '../src/modules/harden';

type Shape = { where: 'own' | 'proto' | 'proto2'; kind: 'data' | 'accessor' | 'getter-only'; configurable: boolean; writable: boolean };
const shapeArb: fc.Arbitrary<Shape> = fc.record({
  where: fc.constantFrom('own', 'proto', 'proto2'),
  kind: fc.constantFrom('data', 'accessor', 'getter-only'),
  configurable: fc.boolean(),
  writable: fc.boolean(),
});

function makeGlobal(shapes: Record<string, Shape>, freezeProto: boolean, storage: Shape) {
  'use strict';
  const proto2: any = {};
  const proto: any = Object.create(proto2);
  const g: any = Object.create(proto);
  const target = (s: Shape) => (s.where === 'own' ? g : s.where === 'proto' ? proto : proto2);
  const define = (o: any, name: string, s: Shape) => {
    const val = { real: name };
    if (s.kind === 'data') Object.defineProperty(o, name, { value: val, writable: s.writable, configurable: s.configurable, enumerable: true });
    else if (s.kind === 'accessor') Object.defineProperty(o, name, { get: () => val, set: () => {}, configurable: s.configurable, enumerable: true });
    else Object.defineProperty(o, name, { get: () => val, configurable: s.configurable, enumerable: true });
  };
  for (const [name, s] of Object.entries(shapes)) define(target(s), name, s);
  const navProto: any = {};
  define(navProto, 'storage', storage);
  g.navigator = Object.create(navProto);
  g.WorkerNavigator = { prototype: navProto };
  if (freezeProto) Object.freeze(proto2);
  return g;
}

describe('hardenWorkerGlobal (Property 5)', () => {
  it('every blocked name reads undefined, or setup throws', () => {
    fc.assert(
      fc.property(
        fc.record(Object.fromEntries(BLOCKED.map((k) => [k, shapeArb])) as Record<string, fc.Arbitrary<Shape>>),
        fc.boolean(),
        shapeArb,
        (shapes, freeze, storage) => {
          const g = makeGlobal(shapes, freeze, storage);
          let threw = false;
          try { hardenWorkerGlobal(g, BLOCKED); } catch (e: any) { threw = true; expect(e.message).toMatch(/logic sandbox setup failed/); }
          if (threw) return;
          for (const k of BLOCKED) expect(g[k], k).toBeUndefined();
          expect(g.navigator.storage).toBeUndefined();
          // a later assignment can't restore it
          for (const k of BLOCKED) { try { g[k] = 1; } catch { /* strict-mode TypeError is fine */ } expect(g[k]).toBeUndefined(); }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('the WorkerGlobalScope shape: a configurable getter-only accessor on the prototype', () => {
    const g = makeGlobal({ indexedDB: { where: 'proto', kind: 'getter-only', configurable: true, writable: false } }, false, { where: 'proto', kind: 'getter-only', configurable: true, writable: false });
    hardenWorkerGlobal(g, ['indexedDB']);
    expect(g.indexedDB).toBeUndefined();
    expect(g.navigator.storage).toBeUndefined();
  });

  it('fails closed when a name cannot be removed', () => {
    const g = makeGlobal({ fetch: { where: 'own', kind: 'getter-only', configurable: false, writable: false } }, false, { where: 'proto', kind: 'data', configurable: true, writable: true });
    expect(() => hardenWorkerGlobal(g, ['fetch'])).toThrow('logic sandbox setup failed: fetch still reachable');
  });
});
