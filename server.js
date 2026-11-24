/**
 * Production entry point, run by `kebena-coffee.service` on the server.
 *
 * `build/index.js` (adapter-node's own server) would normally be enough, but OpenLiteSpeed's
 * reverse proxy forwards the client's `Origin` header *and* appends a second copy of its own:
 *
 *     origin: https://kebena.srv1912542.hstgr.cloud      <- sent by the browser
 *     Origin: https://kebena.srv1912542.hstgr.cloud      <- added by LiteSpeed
 *
 * Node collapses duplicate headers into one comma-joined value, so SvelteKit's CSRF guard compares
 * "https://site, https://site" against url.origin, never matches, and rejects every form POST with
 * 403 "Cross-site POST form submissions are forbidden".
 *
 * We keep the FIRST value, which is the one the browser actually sent, so a genuine cross-site
 * submission is still rejected. Dropping the check altogether (csrf.checkOrigin: false) would have
 * hidden the bug instead. The same wrapper runs alpha-steel on that box.
 */
import http from 'node:http';

/**
 * Who is asking. Behind OpenLiteSpeed every request arrives from 127.0.0.1, so without this
 * `getClientAddress()` is the proxy for everyone and the sign-in and form limits become one shared
 * bucket: a stranger guessing passwords would lock every staff member out.
 *
 * LiteSpeed appends the address it saw to `X-Forwarded-For`, so only the LAST entry is trusted
 * (anything before it came from the client and can be made up). A request that did not come
 * through the local proxy is taken at its socket address and its forwarded headers are ignored.
 * The result goes in a header of our own, always overwritten, which adapter-node is told to read.
 */
const CLIENT_IP_HEADER = 'x-kebena-client-ip';
process.env.ADDRESS_HEADER = CLIENT_IP_HEADER;
delete process.env.XFF_DEPTH;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** @param {import('node:http').IncomingMessage} req */
function client_ip(req) {
	const peer = req.socket.remoteAddress ?? '';
	if (!LOOPBACK.has(peer)) return peer;
	const xff = req.headers['x-forwarded-for'];
	const last = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',').pop()?.trim();
	return last || peer;
}

const { handler } = await import('./build/handler.js');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

/** @param {import('node:http').IncomingMessage} req */
function undouble_origin(req) {
	const origin = req.headers.origin;
	if (typeof origin === 'string' && origin.includes(',')) {
		req.headers.origin = origin.split(',')[0].trim();
	}
}

const server = http.createServer((req, res) => {
	undouble_origin(req);
	req.headers[CLIENT_IP_HEADER] = client_ip(req);
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not Found');
	});
});

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
