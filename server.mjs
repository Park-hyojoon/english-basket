import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFile} from 'node:child_process';

const root=fileURLToPath(new URL('./public/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};

// Local preview only: no AI routes, credentials, or outgoing requests.
export function createServer() {
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        res.writeHead(410,{'Content-Type':'application/json; charset=utf-8'});
        return res.end(JSON.stringify({error:'이 버전은 API를 사용하지 않습니다. ChatGPT로 학습 자료를 가져가 주세요.'}));
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
      const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
      const file=path.resolve(root,relative), resolved=path.relative(root,file);
      if(resolved.startsWith('..')||path.isAbsolute(resolved)){res.writeHead(403);return res.end();}
      if(!MIME[path.extname(file)]){res.writeHead(404);return res.end();}
      const content=await readFile(file);
      res.writeHead(200,{
        'Content-Type':MIME[path.extname(file)],'Cache-Control':'no-cache',
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
      });
      res.end(req.method==='HEAD'?undefined:content);
    } catch {if(!res.headersSent){res.writeHead(404);res.end('Not found');}}
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT||4317);
  createServer().listen(port,'127.0.0.1',()=>{
    console.log(`English Basket: http://localhost:${port} · ChatGPT 자료 전달 방식`);
    if(process.env.BASKET_OPEN_BROWSER==='1'&&process.platform==='win32')execFile('cmd.exe',['/c','start','','http://localhost:'+port],{windowsHide:true},()=>{});
  });
}
