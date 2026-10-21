// Minimal DOM/localStorage stubs so the real app code runs in node.
const store = new Map();
global.localStorage = { getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
function dummyCtx() {
  return new Proxy({}, { get: (t, k) => (k === "measureText" ? () => ({width: 10}) : () => {}), set: () => true });
}
function dummyEl() {
  return { textContent: "", innerHTML: "", value: "", style: {}, clientWidth: 340, width: 0, height: 0,
    getContext: () => dummyCtx(),
    classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(){}, setAttribute(){}, click(){}, focus(){}, setSelectionRange(){} };
}
global.document = { querySelector: () => dummyEl(), querySelectorAll: () => [],
  createElement: () => dummyEl(), getElementById: () => null };
global.window = global; global.scrollTo = () => {};
global.requestAnimationFrame = f => f();
/* app code concatenated below this harness by the build step */

