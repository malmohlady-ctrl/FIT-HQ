// caching querySelector so rendered HTML can be asserted
const _cache = {};
document.querySelector = sel => {
  if (!_cache[sel]) { const el = dummyEl(); el.style = { setProperty(){} }; _cache[sel] = el; }
  return _cache[sel];
};
