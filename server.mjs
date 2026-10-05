import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {execFile} from 'node:child_process';
import {generate,validateRequest} from './coach.mjs';
const root=fileURLToPath(new URL('./public/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
export function createServer(config={}){
  const key=config.key??process.env.OPENAI_API_KEY,token=config.token??process.env.BASKET_TOKEN,model=config.model??process.env.OPENAI_MODEL??'gpt-4o-mini';
  const origins=(config.origins??process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean);
  const limits=new Map();
  const authorized=req=>{const received=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);return !!token&&received.length===expected.length&&timingSafeEqual(received,expected);};
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try{
      const u=new URL(req.url,'http://localhost');
      if(u.pathname.startsWith('/api/')){
        const origin=req.headers.origin;
        const sameOrigin=origin===`${req.socket.encrypted?'https':'http'}://${req.headers.host}`;
        if(origin&&!sameOrigin&&!origins.includes(origin))return json(403,{error:'허용되지 않은 사이트입니다.'});
        if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
        if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});return res.end();}
        if(!authorized(req))return json(401,{error:'설정에서 개인 접속 암호를 확인해 주세요.'});
        if(u.pathname==='/api/health'&&req.method==='GET')return json(200,{ready:!!key,model});
        if(u.pathname!=='/api/coach'||req.method!=='POST')return json(404,{error:'요청을 찾을 수 없습니다.'});
        if(!key)return json(503,{error:'서버에 OPENAI_API_KEY를 설정해 주세요.'});
        if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'JSON 요청이 필요합니다.'});
        const client=req.socket.remoteAddress,now=Date.now();for(const [id,rate] of limits)if(now-rate.at>60000)limits.delete(id);
        const rate=limits.get(client)||{at:now,n:0};if(++rate.n>20)return json(429,{error:'요청이 많습니다. 1분 뒤 다시 시도해 주세요.'});limits.set(client,rate);
        let text='',size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)return json(413,{error:'대화가 너무 길어요. 새 대화를 시작해 주세요.'});text+=chunk;}
        let data;try{data=validateRequest(JSON.parse(text));}catch(e){return json(400,{error:e.message});}
        try{return json(200,await generate(data,{key,model,fetchImpl:config.fetchImpl}));}catch(e){return json(502,{error:e.name==='TimeoutError'?'GPT 응답 시간이 초과되었습니다. 다시 시도해 주세요.':e.message});}
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
      const relative=decodeURIComponent(u.pathname)==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\//,'');
      const file=path.resolve(root,relative);if(!file.startsWith(root)){res.writeHead(403);return res.end();}
      const content=await readFile(file);res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:content);
    }catch{if(!res.headersSent){res.writeHead(404);res.end('Not found');}}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.env.BASKET_TOKEN)console.log('GPT 연결을 위해 .env에 BASKET_TOKEN과 OPENAI_API_KEY를 설정하세요.');
  const port=Number(process.env.PORT||4317);createServer().listen(port,process.env.HOST||'127.0.0.1',()=>{console.log(`English Basket: http://localhost:${port}`);if(process.env.BASKET_OPEN_BROWSER==='1'&&process.platform==='win32')execFile('cmd.exe',['/c','start','','http://localhost:'+port],{windowsHide:true},()=>{});});
}
