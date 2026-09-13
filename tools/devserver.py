#!/usr/bin/env python3
"""Static dev server that never caches and always declares UTF-8.

`python3 -m http.server` lets the browser hold on to stale modules between
edits, and serves HTML with no charset, which garbles non-ASCII characters.
Both cost real debugging time, so the dev server fixes them at the source.
"""

import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4178
    handler = functools.partial(Handler, directory=ROOT)
    print("serving %s on http://localhost:%d" % (ROOT, port))
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
