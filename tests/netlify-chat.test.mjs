import test from 'node:test';
import assert from 'node:assert/strict';
import {createNetlifyChatHandler} from '../netlify/functions/chat.mjs';

function groqResponse(chunks){
  const bytes=new TextEncoder().encode(chunks.map(data=>`data: ${JSON.stringify(data)}\n\n`).join('')+'data: [DONE]\n\n');
  const stream=new ReadableStream({start(controller){
    for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));
    controller.close();
  }});
  return new Response(stream,{status:200});
}

test('Netlify chat function reports unsupported methods',async()=>{
  const response=await createNetlifyChatHandler({})({httpMethod:'GET',headers:{}});
  assert.equal(response.statusCode,405);
  assert.equal(JSON.parse(response.body).error,'method_not_allowed');
});

test('Netlify chat function reports an unset AI key',async()=>{
  const response=await createNetlifyChatHandler({})({httpMethod:'POST',headers:{},body:'{}'});
  assert.equal(response.statusCode,503);
  assert.equal(JSON.parse(response.body).error,'not_configured');
});

test('Netlify chat function returns buffered assistant events',async()=>{
  const originalFetch=globalThis.fetch;
  let request;
  globalThis.fetch=async(url,options)=>{
    request={url,options};
    return groqResponse([
      {choices:[{delta:{content:'Hello from Lumière.'},finish_reason:null}]},
      {choices:[{delta:{},finish_reason:'stop'}]}
    ]);
  };
  try{
    const response=await createNetlifyChatHandler({GROQ_API_KEY:'test-key'})({
      httpMethod:'POST',
      headers:{},
      body:JSON.stringify({messages:[{role:'user',content:'Hello'}]})
    });
    assert.equal(response.statusCode,200);
    assert.match(response.headers['Content-Type'],/^text\/event-stream/);
    assert.match(response.body,/event: delta\ndata: {"t":"Hello from Lumière\."}/);
    assert.match(response.body,/event: done/);
    assert.equal(request.url,'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(request.options.headers.authorization,'Bearer test-key');
    assert.equal(JSON.parse(request.options.body).model,'openai/gpt-oss-120b');
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('Groq tool calls run locally and return book cards',async()=>{
  const originalFetch=globalThis.fetch,calls=[];
  const toolResponse=(id,name,args)=>groqResponse([
    {choices:[{delta:{tool_calls:[{index:0,id,type:'function',function:{name,arguments:args}}]},finish_reason:null}]},
    {choices:[{delta:{},finish_reason:'tool_calls'}]}
  ]);
  globalThis.fetch=async(url,options)=>{
    const request=JSON.parse(options.body);
    calls.push(request);
    if(calls.length===1)return toolResponse('call-search','search_books','{"query":"confidence","limit":1}');
    if(calls.length===2){
      const result=JSON.parse(request.messages[request.messages.length-1].content);
      return toolResponse('call-show','show_books',JSON.stringify({ids:[result.results[0].id]}));
    }
    return groqResponse([{choices:[{delta:{content:'The Confident Speaker is a good fit.'},finish_reason:'stop'}]}]);
  };
  try{
    const response=await createNetlifyChatHandler({GROQ_API_KEY:'test-key'})({
      httpMethod:'POST',
      headers:{},
      body:JSON.stringify({messages:[{role:'user',content:'Recommend a confidence book'}]})
    });
    assert.equal(calls.length,3);
    assert.ok(calls[1].messages.some(message=>message.role==='tool'));
    assert.match(response.body,/event: books/);
    assert.match(response.body,/The Confident Speaker/);
    assert.match(response.body,/event: done/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});

test('Groq rate limits return an actionable chat error',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('rate limited',{status:429});
  try{
    const response=await createNetlifyChatHandler({GROQ_API_KEY:'test-key'})({
      httpMethod:'POST',
      headers:{},
      body:JSON.stringify({messages:[{role:'user',content:'Hello'}]})
    });
    assert.equal(response.statusCode,200);
    assert.match(response.body,/Groq has reached an API rate or usage limit/);
    assert.match(response.body,/Groq Console usage and limits/);
  }finally{
    globalThis.fetch=originalFetch;
  }
});
