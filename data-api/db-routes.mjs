// Server-side API for the shared Supabase database (new, independent add-on; the existing storefront/CRM do NOT call it yet).
// Uses only fetch + environment variables. The service-role key stays on the server.
import {readJson,sendJson,clientIp,makeLimiter} from '../ai-backend/http-utils.mjs';
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/,STAT=['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'],ISTAT=['New','In Progress','Resolved','Closed'];
export function createDbRouter(env){
  const URLB=env.SUPABASE_URL,ANON=env.SUPABASE_ANON_KEY,SVC=env.SUPABASE_SERVICE_ROLE_KEY,configured=!!(URLB&&ANON&&SVC),ok=makeLimiter(30,60000);
  const rest=async(p,{method='GET',body,key=ANON,token,prefer}={})=>{
    const r=await fetch(`${URLB}/rest/v1/${p}`,{method,headers:{apikey:key,Authorization:`Bearer ${token||key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}return{status:r.status,ok:r.ok,json:j}};
  const str=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  async function admin(req){const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return null;const token=h.slice(7);
    const u=await fetch(`${URLB}/auth/v1/user`,{headers:{apikey:ANON,Authorization:`Bearer ${token}`}});if(!u.ok)return null;const user=await u.json();
    const a=await rest(`admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`,{key:SVC});return a.ok&&a.json&&a.json.length?{token,user}:null}
  async function handle(req,res,u){
    if(!configured){sendJson(res,503,{error:'database_not_configured'});return true}
    if(!ok(clientIp(req))){sendJson(res,429,{error:'rate_limited'});return true}
    const route=u.pathname.replace('/api/db/',''),m=req.method;
    try{
      if(route==='products'&&m==='GET'){const r=await rest('products?select=id,title,author,category,price_pkr,original_price_pkr,short_description,rating,review_count,stock_quantity,is_available,is_featured,is_bestseller&order=id');sendJson(res,r.status,r.json);return true}
      if(route==='reviews'&&m==='GET'){const pid=u.searchParams.get('product_id');const r=await rest(`public_reviews?select=*${pid?`&product_id=eq.${encodeURIComponent(pid)}`:''}&order=created_at.desc&limit=50`);sendJson(res,r.status,r.json);return true}
      if(route==='orders'&&m==='POST'){const b=await readJson(req),c=b.customer||{};
        const items=Array.isArray(b.items)?b.items.slice(0,50).map(i=>({product_id:str(i.product_id,40),quantity:Number.isInteger(i.quantity)?i.quantity:0})):[];
        if(str(c.name,100).length<2||!EMAIL.test(str(c.email,200))||!items.length||items.some(i=>!i.product_id||i.quantity<1||i.quantity>50)){sendJson(res,400,{error:'invalid_order'});return true}
        const id='LB-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
        const r=await rest('rpc/place_order',{method:'POST',key:SVC,body:{p_order_id:id,p_customer:{name:str(c.name,100),email:str(c.email,200),phone:str(c.phone,40),address:str(c.address,300),city:str(c.city,80),postal:str(c.postal,20)},p_items:items,p_notes:str(b.notes,500)}});
        sendJson(res,r.ok?201:409,r.ok?r.json:{error:'order_rejected',detail:String(r.json&&r.json.message||'').slice(0,120)});return true}
      if(route==='inquiries'&&m==='POST'){const b=await readJson(req);const row={inquiry_type:str(b.type,40),name:str(b.name,100),email:str(b.email,200),phone:str(b.phone,40)||null,order_id:str(b.order_id,60)||null,subject:str(b.subject,200),message:str(b.message,4000)};
        const r=await rest('inquiries',{method:'POST',body:row,prefer:'return=representation'});sendJson(res,r.ok?201:400,r.ok?{id:r.json[0].id}:{error:'invalid_inquiry'});return true}
      if(route==='newsletter'&&m==='POST'){const b=await readJson(req),e=str(b.email,200).toLowerCase();if(!EMAIL.test(e)){sendJson(res,400,{error:'invalid_email'});return true}
        const r=await rest('newsletter_subscriptions',{method:'POST',body:{email:e},prefer:'resolution=ignore-duplicates'});sendJson(res,r.ok?201:400,{ok:r.ok});return true}
      if(route==='reviews'&&m==='POST'){const b=await readJson(req),e=str(b.email,200).toLowerCase(),pid=str(b.product_id,40),rt=Number(b.rating);
        if(str(b.name,100).length<2||!EMAIL.test(e)||!pid||!Number.isInteger(rt)||rt<1||rt>5||str(b.text,2000).length<10){sendJson(res,400,{error:'invalid_review'});return true}
        const v=await rest(`orders?select=id,customers!inner(email),order_items!inner(product_id)&customers.email=eq.${encodeURIComponent(e)}&order_items.product_id=eq.${encodeURIComponent(pid)}&status=neq.Cancelled&limit=1`,{key:SVC});
        const r=await rest('reviews',{method:'POST',key:SVC,body:{product_id:pid,reviewer_name:str(b.name,100),reviewer_email:e,rating:rt,review_text:str(b.text,2000),is_verified:!!(v.json&&v.json.length)}});sendJson(res,r.ok?201:400,{ok:r.ok});return true}
      if(route==='admin/login'&&m==='POST'){const b=await readJson(req);const r=await fetch(`${URLB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:str(b.email,200),password:String(b.password||'').slice(0,200)})});
        const j=await r.json();sendJson(res,r.ok?200:401,r.ok?{access_token:j.access_token,expires_in:j.expires_in}:{error:'invalid_login'});return true}
      if(route.startsWith('admin/')){const a=await admin(req);if(!a){sendJson(res,401,{error:'admin_only'});return true}
        const parts=route.split('/'),t=parts[1],id=parts[2];const R={orders:'orders?select=*,order_items(*),customers(*)&order_by=created_at.desc',customers:'customers?select=*&order=created_at.desc',inquiries:'inquiries?select=*&order=created_at.desc',reviews:'reviews?select=*&order=created_at.desc',newsletter:'newsletter_subscriptions?select=*&order=created_at.desc',products:'products?select=*&order=id'};
        if(m==='GET'&&R[t]&&!id){const r=await rest(R[t].replace('order_by=','order='),{token:a.token});sendJson(res,r.status,r.json);return true}
        if(m==='PATCH'&&id){const b=await readJson(req),F={orders:{status:v=>STAT.includes(v)&&v,internal_notes:v=>str(v,2000)},inquiries:{status:v=>ISTAT.includes(v)&&v,internal_notes:v=>str(v,2000)},products:{price_pkr:v=>Number.isInteger(v)&&v>0&&v,stock_quantity:v=>Number.isInteger(v)&&v>=0&&v,is_available:v=>typeof v==='boolean'&&v,is_featured:v=>typeof v==='boolean'},reviews:{status:v=>['Published','Hidden'].includes(v)&&v},customers:{internal_notes:v=>str(v,2000)}}[t];
          if(!F){sendJson(res,404,{error:'not_found'});return true}const patch={};for(const k of Object.keys(F))if(k in b){const v=F[k](b[k]);if(v===false){sendJson(res,400,{error:'invalid_'+k});return true}patch[k]=typeof b[k]==='boolean'?b[k]:v}
          if(!Object.keys(patch).length){sendJson(res,400,{error:'nothing_to_update'});return true}
          const r=await rest(`${t}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',token:a.token,body:patch,prefer:'return=representation'});sendJson(res,r.ok?200:400,r.ok?r.json:{error:'update_rejected',detail:String(r.json&&r.json.message||'').slice(0,120)});return true}}
    }catch(e){const s=e.status||500;sendJson(res,s,{error:s===500?'server_error':e.message});return true}
    return false}
  return{configured,handle};
}
