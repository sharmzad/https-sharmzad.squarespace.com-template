#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class SmartCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Smart caching: cache images and static assets, but not HTML
        if self.path.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.ico')):
            # Cache images for 7 days
            self.send_header('Cache-Control', 'public, max-age=604800, immutable')
        elif self.path.endswith(('.css', '.js')):
            # Cache CSS/JS for 1 day
            self.send_header('Cache-Control', 'public, max-age=86400')
        elif self.path.endswith(('.woff', '.woff2', '.ttf', '.eot')):
            # Cache fonts for 30 days
            self.send_header('Cache-Control', 'public, max-age=2592000, immutable')
        else:
            # Don't cache HTML and other files
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    port = 5000
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, SmartCacheHTTPRequestHandler)
    print(f"Server running on port {port}...")
    print("Smart caching enabled:")
    print("  - Images: 7 days")
    print("  - CSS/JS: 1 day")
    print("  - HTML: No cache")
    httpd.serve_forever()
