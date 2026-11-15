/* ===== storage (keys nexus.*; same browser+origin only, not a production database) ===== */
const mem={},DB={get(k,d){try{const v=localStorage.getItem('nexus.'+k);return v===null?(k in mem?mem[k]:d):JSON.parse(v)}catch(e){return k in mem?mem[k]:d}},set(k,v){mem[k]=v;try{localStorage.setItem('nexus.'+k,JSON.stringify(v))}catch(e){}}};
const uid=p=>p+'-'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,5).toUpperCase();
