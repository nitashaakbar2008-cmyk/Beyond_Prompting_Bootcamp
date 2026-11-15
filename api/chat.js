// Optional adapter for hosts that run files in /api as serverless functions (e.g. Vercel). Not used by server-with-ai.mjs.
// Note: the host must bundle context/book-catalogue.json and context/store-policies.md with this function.
import {createChatHandler} from '../ai-backend/chat-handler.mjs';
const handler=createChatHandler({catalogueFile:new URL('../context/book-catalogue.json',import.meta.url),policiesFile:new URL('../context/store-policies.md',import.meta.url)});
export default (req,res)=>handler(req,res);
