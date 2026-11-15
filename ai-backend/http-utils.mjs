// Small shared HTTP helpers: JSON body reading with a size limit, JSON responses, in-memory rate limiter.
export async function readJson(req,limit=65536){
  if(req.body!==undefined&&req.body!==null){return typeof req.body==='string'?JSON.parse(req.body):req.body}
  let size=0;const parts=[];
  for await(const c of req){size+=c.length;if(size>limit){const e=new Error('too_large');e.status=413;throw e}parts.push(c)}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}')}catch{const e=new Error('bad_json');e.status=400;throw e}
}
export function sendJson(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj))}
export function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'?').split(',')[0].trim()}
export function makeLimiter(max,windowMs){const hits=new Map();return ip=>{const now=Date.now(),a=(hits.get(ip)||[]).filter(t=>now-t<windowMs);a.push(now);hits.set(ip,a);if(hits.size>5000)hits.clear();return a.length<=max}}
