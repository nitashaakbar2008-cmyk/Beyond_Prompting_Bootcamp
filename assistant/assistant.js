/* Lumi: live AI reading companion widget. Talks to POST /api/chat (see ai-backend/). No API key exists in the browser.
   Reuses globals from the existing storefront when present: BOOKS, stockOf, cover, and the global [data-add] click handler. */
(function(){
'use strict';
var ENDPOINT=window.LUMIERE_CHAT_ENDPOINT||'/api/chat',STORE='lumiere.lumi.v1';
var history=[],busy=false,pending=null,msgs=[];
var $=function(s,r){return(r||document).querySelector(s)};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmt(t){var out='',list=false;String(t).split('\n').forEach(function(l){var m=l.match(/^\s*[-*•]\s+(.*)$/),x=m?m[1]:l;x=esc(x).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
 if(m){if(!list){out+='<ul>';list=true}out+='<li>'+x+'</li>'}else{if(list){out+='</ul>';list=false}if(x.trim())out+='<p>'+x+'</p>'}});return out+(list?'</ul>':'')}
function pkr(n){return'PKR '+Number(n).toLocaleString('en-PK')}
var root=document.createElement('div');root.id='lm-root';
root.innerHTML='<div class="lm-tip" id="lm-tip" role="note">Need help choosing a book? Ask Lumi.</div>'+
'<button id="lm-fab" aria-label="Open Lumi, your personal reading companion" aria-expanded="false" aria-controls="lm-panel"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 7c4-2 8-2 12 1v17c-4-3-8-3-12-1z" stroke="#F4F0E8" stroke-width="1.6" stroke-linejoin="round"/><path d="M28 7c-4-2-8-2-12 1v17c4-3 8-3 12-1z" stroke="#F4F0E8" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 1.5l1.2 2.6 2.6 1.2-2.6 1.2L16 9.1l-1.2-2.6-2.6-1.2 2.6-1.2z" fill="#C6A15B"/></svg></button>'+
'<section id="lm-panel" role="dialog" aria-label="Lumi, your personal reading companion" hidden>'+
'<div class="lm-head"><div class="lm-av" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 32 32" fill="none"><path d="M4 7c4-2 8-2 12 1v17c-4-3-8-3-12-1z" stroke="#F4F0E8" stroke-width="1.8"/><path d="M28 7c-4-2-8-2-12 1v17c4-3 8-3 12-1z" stroke="#F4F0E8" stroke-width="1.8"/></svg></div><div><h2>Your Personal Reading Companion</h2><p>Lumi · AI assistant for Lumière Books</p></div><button class="lm-x" id="lm-close" aria-label="Close chat">×</button></div>'+
'<div id="lm-log" role="log" aria-live="polite" aria-label="Conversation with Lumi"></div>'+
'<div class="lm-chips" id="lm-chips"></div>'+
'<form id="lm-form"><label class="lm-sr" for="lm-in">Your message to Lumi</label><textarea id="lm-in" rows="1" maxlength="800" placeholder="Tell me what you’re curious about…"></textarea><button id="lm-send" type="submit" aria-label="Send message" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 11.5L21 3l-8.5 18-2-7.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></form>'+
'<p class="lm-note">Lumi is an AI assistant, not a human. Messages are sent to an AI service, so please don’t share personal details.</p></section>';
document.body.appendChild(root);
var fab=$('#lm-fab'),panel=$('#lm-panel'),log=$('#lm-log'),input=$('#lm-in'),send=$('#lm-send'),tip=$('#lm-tip');
var CHIPS=['Something to build my confidence','A gift for someone who loves fiction','What can I buy on a small budget?','How does delivery work?'];
$('#lm-chips').innerHTML=CHIPS.map(function(c){return'<button type="button" class="lm-chip">'+esc(c)+'</button>'}).join('');
function store(){try{sessionStorage.setItem(STORE,JSON.stringify({history:history,msgs:msgs}))}catch(e){}}
function toBottom(){log.scrollTop=log.scrollHeight}
function open(){panel.hidden=false;fab.setAttribute('aria-expanded','true');tip.hidden=true;input.focus()}
function close(){panel.hidden=true;fab.setAttribute('aria-expanded','false');fab.focus()}
fab.addEventListener('click',function(){panel.hidden?open():close()});$('#lm-close').addEventListener('click',close);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden)close()});
setTimeout(function(){tip.hidden=true},9000);
function addMsg(role,html){var d=document.createElement('div');d.className='lm-m '+(role==='me'?'lm-me':'lm-bot');d.innerHTML=html;log.appendChild(d);toBottom();return d}
function cardsHtml(list){return'<div class="lm-cards">'+list.map(function(b){var local=null,cv='';try{local=BOOKS.find(function(x){return x.id===b.id});if(local&&typeof cover==='function')cv=cover(local)}catch(e){}
 var st=b.in_stock?'<span class="lm-ok">In stock</span>':'<span class="lm-no">Out of stock</span>';
 return'<article class="lm-card"><div>'+cv+'</div><div><h3>'+esc(b.title)+'</h3><div class="a">'+esc(b.author)+' · '+esc(b.category)+'</div><div class="p">'+pkr(b.price_pkr)+(b.original_price_pkr?' <s style="font-weight:400;color:#7a857f">'+pkr(b.original_price_pkr)+'</s>':'')+'</div><div class="s">'+st+' · ★ '+esc(b.rating)+'</div><div class="d">'+esc((b.short_description||'').slice(0,110))+'</div><div class="lm-acts"><a class="lm-btn" href="'+esc(b.product_path)+'" data-lm-view>View book</a><button class="lm-btn alt" type="button" data-add="'+esc(b.id)+'"'+(b.in_stock?'':' disabled')+'>Add to cart</button></div></div></article>'}).join('')+'</div>'}
function live(){try{var o={};BOOKS.forEach(function(b){o[b.id]=[b.price,stockOf(b)]});return o}catch(e){return null}}
function showErr(text,retry){var d=document.createElement('div');d.className='lm-err';d.setAttribute('role','alert');d.innerHTML=esc(text)+(retry?'<button class="lm-btn" type="button" data-lm-retry>Try again</button>':'');log.appendChild(d);toBottom();return d}
function setBusy(b){busy=b;send.disabled=b||!input.value.trim();log.setAttribute('aria-busy',b)}
/* Transport: how a conversation reaches the AI. Default = this site's /api/chat (server-sent events). Other hosts may set window.LUMIERE_TRANSPORT. */
async function sseTransport(o){
  var r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:o.messages,live:o.live})});
  if(!r.ok){var j={};try{j=await r.json()}catch(e){}
    if(r.status===503&&j.error==='not_configured')o.onError('Lumi isn’t connected to its AI service yet. You can still browse with Explore Books or the search bar.',false);
    else if(r.status===429)o.onError('Lumi is receiving a lot of questions right now. Please wait a moment and try again.',true);
    else o.onError('Lumi is temporarily unavailable. Please try again shortly.',true);return}
  var rd=r.body.getReader(),dec=new TextDecoder(),buf='';
  for(;;){var c=await rd.read();if(c.done)break;buf+=dec.decode(c.value,{stream:true});var i;
    while((i=buf.indexOf('\n\n'))>=0){var blk=buf.slice(0,i);buf=buf.slice(i+2);var ev='',data='';blk.split('\n').forEach(function(l){if(l.indexOf('event:')===0)ev=l.slice(6).trim();else if(l.indexOf('data:')===0)data+=l.slice(5).trim()});
      if(!data)continue;var d;try{d=JSON.parse(data)}catch(e){continue}
      if(ev==='delta')o.onDelta(d.t);else if(ev==='books')o.onBooks(d.books);else if(ev==='error')o.onError(d.message||'Something went wrong.',true)}}
}
async function run(){
  setBusy(true);var bot=addMsg('bot','<span class="lm-dots" aria-label="Lumi is typing"><i></i><i></i><i></i></span>'),text='',books=null,failed=null,started=false;
  var tr=window.LUMIERE_TRANSPORT||sseTransport;
  try{await tr({messages:history.slice(-14),live:live(),
    onDelta:function(t){text+=t;started=true;bot.innerHTML=fmt(text);toBottom()},
    onText:function(t){text=t;started=true;bot.innerHTML=fmt(text);toBottom()},
    onBooks:function(b){books=b},onError:function(t,retry){failed={t:t,retry:retry}}})}
  catch(e){failed={t:'I couldn’t reach Lumi. Please check your connection and try again.',retry:true}}
  if(!started)bot.remove();else if(books&&books.length){var w=document.createElement('div');w.innerHTML=cardsHtml(books);log.appendChild(w.firstChild);toBottom()}
  if(text){history.push({role:'assistant',content:text});msgs.push({role:'bot',text:text,books:books})}
  if(failed){pending=failed.retry;showErr(failed.t,failed.retry)}else pending=null;
  store();setBusy(false);if(!panel.hidden)input.focus();
}
function submit(t){t=(t||'').trim();if(!t||busy)return;$('#lm-chips').hidden=true;history.push({role:'user',content:t});msgs.push({role:'me',text:t});addMsg('me',esc(t));input.value='';input.style.height='auto';run()}
$('#lm-form').addEventListener('submit',function(e){e.preventDefault();submit(input.value)});
input.addEventListener('input',function(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,110)+'px';send.disabled=busy||!input.value.trim()});
input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit(input.value)}});
$('#lm-chips').addEventListener('click',function(e){var b=e.target.closest('.lm-chip');if(b)submit(b.textContent)});
log.addEventListener('click',function(e){var r=e.target.closest('[data-lm-retry]');if(r&&!busy){r.parentNode.remove();run();return}
  if(e.target.closest('[data-lm-view]')&&window.innerWidth<=520)close();
  var a=e.target.closest('[data-add]');if(a&&!a.disabled){a.textContent='Added ✓';setTimeout(function(){a.textContent='Add to cart'},1500)}});
/* restore this browser session's conversation, or greet */
var saved=null;try{saved=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch(e){}
if(saved&&saved.msgs&&saved.msgs.length){history=saved.history||[];msgs=saved.msgs;$('#lm-chips').hidden=true;msgs.forEach(function(m){if(m.role==='me')addMsg('me',esc(m.text));else{addMsg('bot',fmt(m.text));if(m.books&&m.books.length){var w=document.createElement('div');w.innerHTML=cardsHtml(m.books);log.appendChild(w.firstChild)}}})}
else addMsg('bot',fmt('Hello! I’m Lumi, an AI reading companion for Lumière Books. Tell me what you’re curious about, and I’ll help you find a book that suits you.'));
})();
