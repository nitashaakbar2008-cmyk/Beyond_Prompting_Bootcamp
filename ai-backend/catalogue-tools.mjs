// Catalogue lookup tools the AI model can call. All book facts come from context/book-catalogue.json,
// never from the model's memory. Optional "live" overlay (price/stock from the visitor's browser) is validated.
import fs from 'node:fs';
export function loadCatalogue(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
export function applyLive(books,live){
  if(!live||typeof live!=='object'||Array.isArray(live))return books;
  return books.map(b=>{const v=live[b.id];if(!Array.isArray(v))return b;const[p,s]=v,n={...b};
    if(Number.isInteger(p)&&p>0&&p<1e6)n.price_pkr=p;if(Number.isInteger(s)&&s>=0&&s<1e5){n.stock_quantity=s;n.available=s>0}return n})}
export const brief=b=>({id:b.id,title:b.title,author:b.author,category:b.category,price_pkr:b.price_pkr,original_price_pkr:b.original_price_pkr,in_stock:b.available,copies_available:b.stock_quantity,rating:b.rating,review_count:b.review_count,pages:b.pages,publication_year:b.publication_year,language:b.language,short_description:b.short_description,bestseller:b.bestseller,featured:b.featured,product_path:'#book-'+b.id});
const SYN={motivational:['habits','focus','discipline','goals','confidence','calm','rest','speaker','learning','steady'],motivation:['habits','focus','discipline','goals'],confidence:['confident','speaker','steps','goals'],productivity:['focus','habits','discipline'],money:['investing','finance','pricing','accounting','economics'],business:['startup','marketing','negotiation','pricing','leading'],gift:['novel','stories','letters'],story:['novel','stories','river','orchard'],happy:['happiness','calm'],anxiety:['anxiety','calm','mind'],coding:['python','algorithms','web','software','data','databases'],programming:['python','algorithms','web','software'],faith:['islamic','prophets','ramadan','dua','seerah'],study:['study','exam','thesis','research','learners'],history:['history','empires','ancient','civilizations']};
const tok=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s-]/g,' ').split(/\s+/).filter(t=>t.length>2&&!['the','and','for','with','that','book','books','want','something','about','good','recommend'].includes(t));
export function search(books,a={}){
  const words=[...new Set(tok(a.query).flatMap(t=>[t,...(SYN[t]||[])]))],cat=String(a.category||'').toLowerCase();
  let r=books.filter(b=>(!cat||b.category.toLowerCase().includes(cat)||cat.includes(b.category.toLowerCase().split(' ')[0]))&&(a.max_price==null||b.price_pkr<=a.max_price)&&(a.min_price==null||b.price_pkr>=a.min_price)&&(a.in_stock_only===false||b.available));
  r=r.map(b=>{const t=(b.title+' '+b.author).toLowerCase(),c=b.category.toLowerCase(),d=(b.short_description+' '+b.description).toLowerCase();let s=0;for(const w of words){if(t.includes(w))s+=3;if(c.includes(w))s+=2;if(d.includes(w))s+=1}return{b,s}});
  if(words.length)r=r.filter(x=>x.s>0);
  const sorts={price_asc:(x,y)=>x.b.price_pkr-y.b.price_pkr,price_desc:(x,y)=>y.b.price_pkr-x.b.price_pkr,rating:(x,y)=>y.b.rating-x.b.rating,pages_asc:(x,y)=>x.b.pages-y.b.pages,relevance:(x,y)=>y.s-x.s||y.b.rating-x.b.rating};
  r.sort(sorts[a.sort]||sorts.relevance);const n=Math.min(Math.max(parseInt(a.limit)||6,1),10);
  return{count_matching:r.length,results:r.slice(0,n).map(x=>brief(x.b)),note:r.length?undefined:'No catalogue book matches. Say so honestly and offer the closest alternatives (e.g. search a broader category).'};
}
export const TOOLS=[
 {name:'search_books',description:'Search the real Lumière Books catalogue. Use for any request to find, recommend, filter or sort books. Returns real titles, PKR prices and stock.',input_schema:{type:'object',properties:{query:{type:'string',description:'Topic/keywords, e.g. "confidence", "python", "ancient history"'},category:{type:'string',description:'Optional category name, e.g. "Self-Development"'},max_price:{type:'integer',description:'Maximum price in PKR'},min_price:{type:'integer'},in_stock_only:{type:'boolean',description:'Default true'},sort:{type:'string',enum:['relevance','price_asc','price_desc','rating','pages_asc']},limit:{type:'integer',description:'1-10, default 6'}}}},
 {name:'get_book',description:'Get full real details of one book by id (e.g. "b3").',input_schema:{type:'object',properties:{id:{type:'string'}},required:['id']}},
 {name:'compare_books',description:'Get real details of 2-4 books side by side to compare them.',input_schema:{type:'object',properties:{ids:{type:'array',items:{type:'string'},minItems:2,maxItems:4}},required:['ids']}},
 {name:'list_categories',description:'List the real categories with their descriptions, intended readers and book counts.',input_schema:{type:'object',properties:{}}},
 {name:'show_books',description:'Display up to 4 book cards (cover, real price, stock, link) in the chat for the books you are recommending. Call this once with the final recommended ids, then explain each in your reply.',input_schema:{type:'object',properties:{ids:{type:'array',items:{type:'string'},minItems:1,maxItems:4}},required:['ids']}}
];
export function runTool(name,input,books,cats){
  const by=id=>books.find(b=>b.id===String(id));input=input&&typeof input==='object'?input:{};
  if(name==='search_books')return search(books,input);
  if(name==='get_book'){const b=by(input.id);return b?{...brief(b),description:b.description,isbn_demo:b.isbn,publisher:b.publisher}:{error:'No book with that id.'}}
  if(name==='compare_books'){const l=(input.ids||[]).slice(0,4).map(by).filter(Boolean);return l.length>=1?{books:l.map(b=>({...brief(b),description:b.description}))}:{error:'No matching books.'}}
  if(name==='list_categories')return{categories:cats.map(c=>({name:c.name,description:c.description,intended_readers:c.audience,book_count:books.filter(b=>b.category===c.name).length}))};
  if(name==='show_books'){const ok=(input.ids||[]).map(by).filter(Boolean).slice(0,4);return{shown:ok.map(b=>b.id),invalid:(input.ids||[]).filter(i=>!by(i))}}
  return{error:'Unknown tool.'};
}
