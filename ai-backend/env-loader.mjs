// Minimal .env loader (no dependencies). Existing environment variables win over the file.
import fs from 'node:fs';
export function loadEnv(file='.env'){try{for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'')}}catch{/* no .env file: fine */}}
