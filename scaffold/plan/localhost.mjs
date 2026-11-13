// localhost.mjs — the page servers answer only requests addressed to this machine (D-106). A hostile page in the same
// browser can point its own domain at 127.0.0.1 (DNS rebinding); its requests then carry that domain in the Host header
// and pass a same-origin check that compares Origin with Host. Refusing every Host that is not a local name closes it.
const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** The Host header's name (without the port) is a local one. */
export function localHost(req) {
  const h = String(req?.headers?.host || '').trim().toLowerCase();
  if (!h) return false;
  const name = h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.replace(/:\d+$/, '');
  return LOCAL.has(name);
}

/** Answer 421 and return true when the request was not addressed to this machine; the caller then stops. */
export function refuseForeignHost(req, res) {
  if (localHost(req)) return false;
  res.writeHead(421, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('This page answers only on 127.0.0.1 or localhost.');
  return true;
}
