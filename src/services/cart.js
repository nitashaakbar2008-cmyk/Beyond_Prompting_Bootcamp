/* ===== cart ===== */
function add(id,q=1){const b=byId(id);if(!b||!Number.isInteger(q)||q<1)return;const c=cart(),l=c.find(x=>x.id===id),nq=(l?l.qty:0)+q;
 if(stockOf(b)<1){toast('This book is out of stock');return}if(nq>stockOf(b)){toast('Only '+stockOf(b)+' available');return}
 l?l.qty=nq:c.push({id,qty:q});DB.set('cart',c);upd();toast('Added to cart: '+b.title)}
function setQ(id,q){const b=byId(id);q=Math.min(q,b?stockOf(b):0);DB.set('cart',q<=0?cart().filter(x=>x.id!==id):cart().map(x=>x.id===id?{...x,qty:q}:x));upd();route()}
const lines=()=>cart().map(l=>({...l,b:byId(l.id)})).filter(l=>l.b);
function totals(){const sub=lines().reduce((s,l)=>s+l.b.price*l.qty,0),del=!sub||sub>=5000?0:250;return{sub,del,total:sub+del}}
const upd=()=>{$('#count').textContent=count();$('#wcount').textContent=DB.get('wishlist',[]).length};
