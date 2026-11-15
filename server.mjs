// Lumière Books server: static files, the AI assistant API (/api/chat) and, if configured, the optional database API (/api/db/*).
// Secrets (ANTHROPIC_API_KEY, Supabase keys) are read from environment variables only. Dependency-free; Node 18+.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {loadEnv} from './ai-backend/env-loader.mjs';loadEnv();
import {createChatHandler} from './ai-backend/chat-handler.mjs';
import {createDbRouter} from './data-api/db-routes.mjs';
import {sendJson} from './ai-backend/http-utils.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT)||5173;
const chat=createChatHandler({catalogueFile:path.join(root,'context/book-catalogue.json'),policiesFile:path.join(root,'context/store-policies.md')});
const db=createDbRouter(process.env);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const PRIVATE=['/ai-backend','/data-api','/database','/api/','/scripts','/context','/docs','/prompts','/node_modules'];
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x'),p=decodeURIComponent(u.pathname);
 if(p==='/api/chat')return chat(req,res);
 if(p==='/api/health')return sendJson(res,200,{ai:!!process.env.ANTHROPIC_API_KEY,database:db.configured});
 if(p.startsWith('/api/db/')){if(await db.handle(req,res,u))return;return sendJson(res,404,{error:'not_found'})}
 let f=path.join(root,p);
 if(!f.startsWith(root)||p.split('/').some(s=>s.startsWith('.'))||PRIVATE.some(x=>p===x||p.startsWith(x.endsWith('/')?x:x+'/'))||/\.(mjs|sql|md)$/.test(p)){res.writeHead(403);return res.end('Forbidden')}
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');
 res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}).listen(port,()=>console.log(`LUMIÈRE BOOKS running:\n  Storefront  http://localhost:${port}/\n  CRM         http://localhost:${port}/admin\n  AI assistant key configured: ${!!process.env.ANTHROPIC_API_KEY}`));
