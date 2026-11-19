import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createChatHandler} from '../../ai-backend/chat-handler.mjs';

// Netlify bundles this file to CommonJS, where import.meta.url is undefined, so never assume it exists.
function moduleDir(){
  try{if(typeof __dirname==='string')return __dirname}catch{}
  try{const url=import.meta&&import.meta.url;if(url)return path.dirname(fileURLToPath(url))}catch{}
  return null;
}
function findRoot(){
  const starts=[process.env.LAMBDA_TASK_ROOT,process.cwd(),moduleDir()].filter(Boolean);
  for(const start of starts){
    let dir=start;
    for(let i=0;i<6;i++){
      if(fs.existsSync(path.join(dir,'context','book-catalogue.json')))return dir;
      const parent=path.dirname(dir);
      if(parent===dir)break;
      dir=parent;
    }
  }
  throw new Error('Could not locate the chatbot context files');
}
const root=findRoot();

export function createNetlifyChatHandler(env=process.env){
  const chat=createChatHandler({
    catalogueFile:path.join(root,'context','book-catalogue.json'),
    policiesFile:path.join(root,'context','store-policies.md'),
    env
  });
  return async function handle(event){
    const headers=event.headers||{};
    const body=event.body==null?'{}':event.isBase64Encoded?Buffer.from(event.body,'base64').toString('utf8'):event.body;
    const req={method:event.httpMethod,headers,body,socket:{remoteAddress:headers['x-nf-client-connection-ip']||''}};
    let statusCode=200,responseHeaders={},responseBody='',ended=false;
    const res={
      get writableEnded(){return ended},
      writeHead(status,values){statusCode=status;responseHeaders={...values};delete responseHeaders.Connection;return this},
      write(chunk){responseBody+=chunk;return true},
      end(chunk){if(chunk)responseBody+=chunk;ended=true;return this},
      on(){return this}
    };
    await chat(req,res);
    if(!ended)res.end();
    return{statusCode,headers:responseHeaders,body:responseBody,isBase64Encoded:false};
  };
}

export const handler=createNetlifyChatHandler();
