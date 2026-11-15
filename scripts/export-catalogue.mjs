// Reads the EXISTING catalogue (src/data/catalogue.js, read-only) and writes context/book-catalogue.json.
// Usage (from the project root): node scripts/export-catalogue.mjs
import fs from 'node:fs';import vm from 'node:vm';
const read=f=>fs.readFileSync(f,'utf8');
const ctx=vm.createContext({console,Date,Math,JSON});
vm.runInContext(read('src/utils/storage.js')+'\n'+read('src/data/catalogue.js')+'\n;globalThis.__out={BOOKS,CAT:CAT.map(c=>({name:c[0],description:c[2],audience:c[3]}))};',ctx);
const {BOOKS,CAT}=ctx.__out;
const books=BOOKS.map(b=>({id:b.id,title:b.title,author:b.author,category:b.category,price_pkr:b.price,original_price_pkr:b.originalPrice||null,short_description:b.short,description:b.long,rating:b.rating,review_count:b.reviews,stock_quantity:b.stock,available:b.stock>0,isbn:b.isbn,publisher:b.publisher,publication_year:b.year,pages:b.pages,language:b.language,featured:!!b.featured,bestseller:!!b.bestseller}));
fs.mkdirSync('context',{recursive:true});
fs.writeFileSync('context/book-catalogue.json',JSON.stringify({_note:'Fictional demonstration data exported from src/data/catalogue.js. Ratings, review counts, ISBNs, publishers and stock are demo values. Reading difficulty is NOT recorded.',currency:'PKR',categories:CAT,books},null,1));
console.log(`Wrote context/book-catalogue.json with ${books.length} books`);
