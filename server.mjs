import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const port=Number(process.env.PORT)||3000;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp'};
http.createServer(async(req,res)=>{
  try {
    const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+requestPath+(requestPath.endsWith('/')?'index.html':''));
    if(!target.startsWith(root)){res.writeHead(403);res.end('Acesso negado');return;}
    const body=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(body);
  } catch {res.writeHead(404);res.end('Arquivo não encontrado');}
}).listen(port,'127.0.0.1',()=>console.log(`Aplicativo disponível em http://127.0.0.1:${port}`));
