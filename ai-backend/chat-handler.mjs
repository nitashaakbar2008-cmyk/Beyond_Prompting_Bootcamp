// Groq chat endpoint with server-side tool use. The API key is never sent to the browser.
import fs from 'node:fs';
import {loadCatalogue,applyLive,TOOLS,runTool,brief} from './catalogue-tools.mjs';
import {buildSystemPrompt} from './system-prompt.mjs';
import {readJson,sendJson,clientIp,makeLimiter} from './http-utils.mjs';

const MAX_TURNS=5;
const DEFAULT_API='https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL='openai/gpt-oss-120b';
const API_TOOLS=TOOLS.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.input_schema}}));

export function createChatHandler({catalogueFile,policiesFile,env=process.env}){
  const api=env.GROQ_API_URL||DEFAULT_API;
  const cat=loadCatalogue(catalogueFile),policies=fs.readFileSync(policiesFile,'utf8'),ok=makeLimiter(20,60000);
  const system=buildSystemPrompt({policies,categories:cat.categories,bookCount:cat.books.length});

  return async function handle(req,res){
    if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
    if(!ok(clientIp(req)))return sendJson(res,429,{error:'rate_limited'});
    if(!env.GROQ_API_KEY)return sendJson(res,503,{error:'not_configured'});

    let body;
    try{body=await readJson(req)}catch(e){return sendJson(res,e.status||400,{error:e.message})}
    if(!body||typeof body!=='object'||Array.isArray(body))body={};
    let msgs=Array.isArray(body.messages)?body.messages.slice(-20):[];
    msgs=msgs.filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.trim())
      .map(m=>({role:m.role,content:m.content.slice(0,1500)}));
    while(msgs.length&&msgs[0].role!=='user')msgs.shift();
    if(!msgs.length||msgs[msgs.length-1].role!=='user')return sendJson(res,400,{error:'invalid_messages'});

    const books=applyLive(cat.books,body.live);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store',Connection:'keep-alive','X-Accel-Buffering':'no'});
    const send=(event,data)=>{if(!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)};
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),60000);
    res.on('close',()=>{clearTimeout(timer);ac.abort()});
    const shown=new Set();

    try{
      for(let turn=0;turn<MAX_TURNS;turn++){
        const r=await fetch(api,{method:'POST',signal:ac.signal,headers:{'content-type':'application/json',authorization:`Bearer ${env.GROQ_API_KEY}`},
          body:JSON.stringify({model:env.GROQ_MODEL||DEFAULT_MODEL,max_completion_tokens:1024,stream:true,tool_choice:'auto',tools:API_TOOLS,messages:[{role:'system',content:system},...msgs]})});
        if(!r.ok){
          console.error('[chat] provider status',r.status);
          const message=r.status===429
            ?'Groq has reached an API rate or usage limit. Check your Groq Console usage and limits, or wait for the limit to reset before trying again.'
            :r.status===401
              ?'Groq rejected the API key. Check GROQ_API_KEY in your server environment and restart the server.'
              :r.status===404
                ?'The configured Groq model was not found. Check the GROQ_MODEL setting.'
                :'The assistant is temporarily unavailable. Please try again shortly.';
          send('error',{message});
          break;
        }

        const textParts=[],calls=new Map();
        let finishReason=null,buf='',streamDone=false;
        const decoder=new TextDecoder();
        const onData=data=>{
          if(data==='[DONE]'){streamDone=true;return}
          const event=JSON.parse(data);
          if(event.error)throw new Error('AI provider stream failed');
          const choice=event.choices&&event.choices[0];
          if(!choice)return;
          const delta=choice.delta||{};
          if(typeof delta.content==='string'&&delta.content){
            textParts.push(delta.content);
            send('delta',{t:delta.content});
          }
          for(const part of delta.tool_calls||[]){
            const index=Number.isInteger(part.index)?part.index:calls.size;
            let call=calls.get(index);
            if(!call){call={id:'',name:'',arguments:''};calls.set(index,call)}
            if(part.id)call.id=part.id;
            if(part.function&&part.function.name)call.name+=part.function.name;
            if(part.function&&part.function.arguments)call.arguments+=part.function.arguments;
          }
          if(choice.finish_reason)finishReason=choice.finish_reason;
        };
        const onBlock=block=>{
          for(const line of block.split(/\r?\n/)){
            if(!line.startsWith('data:'))continue;
            const data=line.slice(5).trim();
            if(data)onData(data);
          }
        };

        for await(const chunk of r.body){
          buf+=decoder.decode(chunk,{stream:true});
          let match;
          while((match=/\r?\n\r?\n/.exec(buf))){
            const block=buf.slice(0,match.index);buf=buf.slice(match.index+match[0].length);onBlock(block);
          }
          if(streamDone)break;
        }
        buf+=decoder.decode();
        if(buf.trim()&&!streamDone)onBlock(buf);

        const toolCalls=[...calls.values()].filter(call=>call.id&&call.name);
        if(finishReason!=='tool_calls'||!toolCalls.length)break;
        msgs.push({role:'assistant',content:textParts.join('')||null,tool_calls:toolCalls.map(call=>({
          id:call.id,type:'function',function:{name:call.name,arguments:call.arguments||'{}'}
        }))});

        for(const call of toolCalls){
          let input={};
          try{input=JSON.parse(call.arguments||'{}')}catch{}
          const out=runTool(call.name,input,books,cat.categories);
          if(call.name==='show_books')for(const id of out.shown)shown.add(id);
          msgs.push({role:'tool',tool_call_id:call.id,name:call.name,content:JSON.stringify(out)});
        }
        if(shown.size)send('books',{books:[...shown].map(id=>books.find(b=>b.id===id)).filter(Boolean).map(brief)});
      }
      send('done',{});
    }catch(e){
      if(e.name!=='AbortError'){console.error('[chat] error',e.message);send('error',{message:'Something went wrong. Please try again.'})}
      else send('error',{message:'The request timed out. Please try again.'});
    }finally{
      clearTimeout(timer);
      res.end();
    }
  };
}
