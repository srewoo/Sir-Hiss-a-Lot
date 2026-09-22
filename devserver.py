# Dev-only static server that also accepts POST /_save/<path> to write a file.
# Used to pull generated icons/screenshots out of the browser onto disk.
import http.server, os, base64, sys
ROOT = sys.argv[1]

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_POST(self):
        if not self.path.startswith('/_save/'):
            self.send_error(404); return
        rel = self.path[len('/_save/'):]
        dest = os.path.normpath(os.path.join(ROOT, rel))
        if not dest.startswith(ROOT): self.send_error(403); return
        n = int(self.headers.get('Content-Length', 0))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, 'wb').write(base64.b64decode(self.rfile.read(n)))
        self.send_response(200); self.send_header('Content-Length','2')
        self.send_header('Access-Control-Allow-Origin','*'); self.end_headers()
        self.wfile.write(b'ok')
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', 8777), H).serve_forever()
