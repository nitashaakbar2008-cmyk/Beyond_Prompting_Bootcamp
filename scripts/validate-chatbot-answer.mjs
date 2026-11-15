// Checks a chatbot answer (text file) against the real catalogue: do mentioned books exist, and do quoted PKR prices match them?
// Usage: node scripts/validate-chatbot-answer.mjs path/to/answer.txt
import fs from 'node:fs';
const cat=JSON.parse(fs.readFileSync(new URL('../context/book-catalogue.json',import.meta.url),'utf8')).books;
const text=fs.readFileSync(process.argv[2]||0,'utf8'),low=text.toLowerCase();
const mentioned=cat.filter(b=>low.includes(b.title.toLowerCase()));
const amounts=[...text.matchAll(/PKR\s?([\d,]+)/gi)].map(m=>Number(m[1].replace(/,/g,'')));
const policyAmounts=new Set([250,5000]);const problems=[];
for(const a of amounts){if(policyAmounts.has(a))continue;if(!mentioned.some(b=>b.price_pkr===a||b.original_price_pkr===a))problems.push(`PKR ${a} does not match the price of any mentioned book`)}
for(const b of mentioned){const i=low.indexOf(b.title.toLowerCase()),near=low.slice(i,i+220);
  if(!b.available&&/in stock|available now/.test(near)&&!/out of stock|not available|unavailable/.test(near))problems.push(`"${b.title}" is out of stock but the answer may call it available`)}
console.log(`Books recognised in the answer: ${mentioned.length?mentioned.map(b=>`${b.title} (PKR ${b.price_pkr}, ${b.available?'in stock':'out of stock'})`).join('; '):'none'}`);
console.log(problems.length?'PROBLEMS:\n- '+problems.join('\n- '):'No price/stock mismatches found for the recognised books. (Titles the catalogue does not contain cannot be detected by this simple check; review by eye.)');
process.exit(problems.length?1:0);
