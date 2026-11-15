// Live AI chat endpoint: streams a real model response (Anthropic Messages API, tool use) to the browser as Server-Sent Events.
// The API key is read ONLY from the server environment (ANTHROPIC_API_KEY). It is never sent to the browser.
import fs from 'node:fs';
import {loadCatalogue,applyLive,TOOLS,runTool,brief} from './catalogue-tools.mjs';
import {buildSystemPrompt} from './system-prompt.mjs';
import {readJson,sendJson,clientIp,makeLimiter} from './http-utils.mjs';
const MAX_TURNS=5;
export function createChatHandler({catalogueFile,policiesFile,env=process.env}){
  const API=env.ANTHROPIC_API_URL||'https://api.anthropic.com/v1/messages';
  const cat=loadCatalogue(catalogueFile),policies=fs.readFileSync(policiesFile,'utf8'),ok=makeLimiter(20,60000);
  const system=buildSystemPrompt({policies,categories:cat.categories,bookCount:cat.books.length});
  return async function handle(req,res){
    if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
    if(!ok(clientIp(req)))return sendJson(res,429,{error:'rate_limited'});
    if(!env.ANTHROPIC_API_KEY)return sendJson(res,503,{error:'not_configured'});
    let body;try{body=await readJson(req)}catch(e){return sendJson(res,e.status||400,{error:e.message})}
    let msgs=Array.isArray(body.messages)?body.messages.slice(-20):[];
    msgs=msgs.filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.trim()).map(m=>({role:m.role,content:m.content.slice(0,1500)}));
    while(msgs.length&&msgs[0].role!=='user')msgs.shift();
    if(!msgs.length||msgs[msgs.length-1].role!=='user')return sendJson(res,400,{error:'invalid_messages'});
    const books=applyLive(cat.books,body.live);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store',Connection:'keep-alive','X-Accel-Buffering':'no'});
    const send=(e,d)=>{if(!res.writableEnded)res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`)};
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),60000);res.on('close',()=>{clearTimeout(timer);ac.abort()});
    const shown=new Set();
    try{
      for(let turn=0;turn<MAX_TURNS;turn++){
        const r=await fetch(API,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
          body:JSON.stringify({model:env.ANTHROPIC_MODEL||'claude-sonnet-5-5',max_tokens:1024,stream:true,system,tools:TOOLS,messages:msgs})});
        if(!r.ok){console.error('[chat] provider status',r.status);send('error',{message:'The assistant is temporarily unavailable. Please try again.'});break}
        const content=[];let cur=null,stop=null,buf='';const dec=new TextDecoder();
        const onEvent=(ev,d)=>{
          if(ev==='content_block_start'){cur=d.content_block.type==='tool_use'?{type:'tool_use',id:d.content_block.id,name:d.content_block.name,json:''}:{type:'text',text:''}}
          else if(ev==='content_block_delta'&&cur){if(d.delta.type==='text_delta'){cur.text+=d.delta.text;send('delta',{t:d.delta.text})}else if(d.delta.type==='input_json_delta')cur.json+=d.delta.partial_json}
          else if(ev==='content_block_stop'&&cur){if(cur.type==='tool_use'){let input={};try{input=JSON.parse(cur.json||'{}')}catch{}content.push({type:'tool_use',id:cur.id,name:cur.name,input})}else if(cur.text)content.push({type:'text',text:cur.text});cur=null}
          else if(ev==='message_delta'&&d.delta)stop=d.delta.stop_reason||stop;
        };
        for await(const chunk of r.body){buf+=dec.decode(chunk,{stream:true});let i;
          while((i=buf.indexOf('\n\n'))>=0){const block=buf.slice(0,i);buf=buf.slice(i+2);let ev='',data='';
            for(const l of block.split('\n')){if(l.startsWith('event:'))ev=l.slice(6).trim();else if(l.startsWith('data:'))data+=l.slice(5).trim()}
            if(data){try{onEvent(ev,JSON.parse(data))}catch{}}}}
        if(stop!=='tool_use'){break}
        msgs.push({role:'assistant',content});const results=[];
        for(const b of content.filter(x=>x.type==='tool_use')){const out=runTool(b.name,b.input,books,cat.categories);
          if(b.name==='show_books')for(const id of out.shown)shown.add(id);
          results.push({type:'tool_result',tool_use_id:b.id,content:JSON.stringify(out)})}
        if(shown.size)send('books',{books:[...shown].map(id=>books.find(b=>b.id===id)).filter(Boolean).map(brief)});
        msgs.push({role:'user',content:results});
      }
      send('done',{});
    }catch(e){if(e.name!=='AbortError'){console.error('[chat] error',e.message);send('error',{message:'Something went wrong. Please try again.'})}else send('error',{message:'The request timed out. Please try again.'})}
    finally{clearTimeout(timer);res.end()}
  };
}
