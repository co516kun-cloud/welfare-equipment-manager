#!/usr/bin/env python3
import http.server
import socketserver
import os

# Change to the dist directory
os.chdir('dist')

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
})

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Server running at http://0.0.0.0:{PORT}/")
    print(f"Access from Windows: http://172.30.160.7:{PORT}/")
    httpd.serve_forever()