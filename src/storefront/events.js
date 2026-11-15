/* ===== events ===== */
document.addEventListener('click',e=>{const t=e.target.closest('[data-add],[data-addq],[data-q],[data-cat],[data-reset]');if(!t)return;const d=t.dataset;
 if(d.add)add(d.add);else if(d.addq){const q=+$('#dq').value;if(!Number.isInteger(q)||q<1)toast('Enter a quantity of 1 or more');else add(d.addq,q)}
 else if(d.q){const[a,b]=d.q.split(':');setQ(a,+b)}
 else if(d.cat){S.cat=d.cat;if(location.hash==='#shop')route();else location.hash='shop'}
 else if('reset'in d){Object.assign(S,{q:'',cat:'All',min:'',max:'',inStock:false,rating:0,sort:'featured'});$('#q').value='';route()}});
document.addEventListener('change',e=>{const t=e.target;if(t.id==='sort'){S.sort=t.value;route()}else if(t.dataset.f){const k=t.dataset.f;S[k]=t.type==='checkbox'?t.checked:k==='rating'?+t.value:t.value;route()}});
$('#q').addEventListener('input',e=>{S.q=e.target.value;location.hash==='#shop'?route():location.hash='shop'});
$('#mb').onclick=()=>{const o=$('#nv').classList.toggle('open');$('#mb').setAttribute('aria-expanded',o)};
function bad(id,m){$('#e-'+id).textContent=m;$('#'+id).setAttribute('aria-invalid',!!m);return !m}
const em=v=>/^\S+@\S+\.\S+$/.test(v);
document.addEventListener('submit',e=>{const f=e.target;e.preventDefault();const v=id=>$('#'+id).value.trim();
 if(f.id==='hf'){S.q=v('hq');$('#q').value=S.q;location.hash='shop';return}
 if(f.id==='nl'){const m=v('nle').toLowerCase();if(!em(m)){$('#nlerr').textContent='Enter a valid email, like name@example.com.';return}$('#nlerr').textContent='';
  const a=DB.get('newsletter',[]);if(!a.some(x=>x.email===m))a.push({id:uid('NL'),email:m,createdAt:new Date().toISOString()});DB.set('newsletter',a);$('#nle').value='';toast('Subscribed (demo record saved locally)');return}
 if(f.id==='fb'){let ok=true,first;const chk=(id,c,m)=>{const g=bad(id,c?'':m);if(!g&&ok){ok=false;first=id}};
  chk('fname',v('fname').length>1,'Enter your name.');chk('femail',em(v('femail')),'Enter a valid email address.');chk('fsub',v('fsub').length>2,'Enter a subject.');chk('fmsg',v('fmsg').length>=10,'Enter a message of at least 10 characters.');
  if(!ok){$('#'+first).focus();return}
  DB.set('inquiries',[...DB.get('inquiries',[]),{id:uid('INQ'),type:v('ftype'),name:v('fname'),email:v('femail').toLowerCase(),phone:v('fphone'),orderId:v('forder'),subject:v('fsub'),message:v('fmsg'),status:'New',createdAt:new Date().toISOString()}]);
  const id=DB.get('inquiries').slice(-1)[0].id;f.reset();$('#fok').textContent='Thank you. Your message was saved as '+id+'. (Demo: stored in this browser only.)';return}
 if(f.id==='co'){let ok=true,first;const chk=(id,c,m)=>{const g=bad(id,c?'':m);if(!g&&ok){ok=false;first=id}};
  chk('name',v('name').length>1,'Enter your full name.');chk('email',em(v('email')),'Enter a valid email, like name@example.com.');chk('phone',/^[+\d][\d\s-]{6,}$/.test(v('phone')),'Enter a valid phone number.');chk('address',v('address').length>5,'Enter your delivery address.');chk('city',v('city').length>1,'Enter your city.');chk('postal',/^[\w\s-]{3,10}$/.test(v('postal')),'Enter a valid postal code.');
  if(!ok){$('#'+first).focus();return}
  const L=lines();if(L.some(l=>l.qty>stockOf(l.b))){toast('Some items exceed available stock. Please review your cart.');location.hash='cart';return}
  const t=totals(),cust={name:v('name'),email:v('email').toLowerCase(),phone:v('phone'),address:v('address'),city:v('city'),postal:v('postal')},id=uid('NB');
  const o={id,customerEmail:cust.email,customer:cust,items:L.map(l=>({productId:l.id,title:l.b.title,price:l.b.price,qty:l.qty})),subtotal:t.sub,delivery:t.del,total:t.total,payment:'Cash on Delivery (demo)',notes:v('notes'),status:'Pending',createdAt:new Date().toISOString()};
  DB.set('orders',[...DB.get('orders',[]),o]);const cs=DB.get('customers',[]),c=cs.find(x=>x.email===cust.email);c?Object.assign(c,cust):cs.push({...cust,id:uid('C'),createdAt:new Date().toISOString()});DB.set('customers',cs);
  const s=DB.get('sold',{});L.forEach(l=>s[l.id]=(s[l.id]||0)+l.qty);DB.set('sold',s);DB.set('cart',[]);upd();location.hash='order-'+id}});
