import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  console.log('Request:', req.url);
  
  // CORS ヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  let filePath;
  
  // 静的ファイルの場合（拡張子あり）
  if (req.url.includes('.')) {
    filePath = path.join(__dirname, 'dist', req.url);
  }
  // SPAルーティングの場合（ルート含む、拡張子なし）
  else {
    filePath = path.join(__dirname, 'dist', 'index.html');
  }
  
  console.log('Serving file:', filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error('File not found:', filePath);
      res.writeHead(404);
      res.end(`<!DOCTYPE html>
<html>
<head>
    <title>File Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
        .error { color: #e74c3c; }
        .info { color: #3498db; margin-top: 20px; }
    </style>
</head>
<body>
    <h1 class="error">404 - File Not Found</h1>
    <p>Requested: ${req.url}</p>
    <p>File path: ${filePath}</p>
    <div class="info">
        <p>Try accessing:</p>
        <p><a href="/index.html">http://localhost:8000/index.html</a></p>
        <p><a href="/">http://localhost:8000/</a></p>
    </div>
</body>
</html>`);
    } else {
      const ext = path.extname(filePath);
      let contentType = 'text/html';
      
      switch (ext) {
        case '.js':
          contentType = 'application/javascript';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'dist')}`);
  console.log(`📱 Access app at: http://localhost:${PORT}`);
  console.log(`📝 Manual import: http://localhost:${PORT}/manual-import`);
});