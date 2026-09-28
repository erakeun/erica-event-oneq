const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root=process.env.MACH_REPOS_ROOT||path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
 const parts=pathname.split('/').filter(Boolean), repo=parts.shift();
 if(!['erica-event-oneq','erica-seat-planner','nameplate-maker'].includes(repo)){res.writeHead(404);return res.end();}
 const base=path.join(root,repo,repo==='erica-seat-planner'?'dist':'');
 const file=path.resolve(base,...parts,pathname.endsWith('/')?'index.html':'');
 if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
 try{const content=await fs.readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(content);}catch{res.writeHead(404);res.end();}
}).listen(4177,'127.0.0.1',()=>console.log('MACH test server ready on 4177'));
