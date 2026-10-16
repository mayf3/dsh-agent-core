// Proposed, separately approved TLS termination only. No credential storage,
// token caching, retries, discovery, management API, or business routing.
import https from 'node:https'
import http from 'node:http'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'

const MAX_REQUEST=16384, MAX_RESPONSE=65536
const reject=(res,status)=>{
  if(res.headersSent)return res.destroy()
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',pragma:'no-cache'})
  res.end('{"error":"tls_proxy_rejected"}')
}

export function createTokenProxy({key,cert,upstreamPort=4001}) {
  const server=https.createServer({key,cert,minVersion:'TLSv1.2',maxHeaderSize:8192},async(req,res)=>{
    res.setHeader('cache-control','no-store')
    res.setHeader('pragma','no-cache')
    if(req.method!=='POST'||req.url!=='/oauth/token')return reject(res,404)
    if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return reject(res,415)
    if(Number(req.headers['content-length'])>MAX_REQUEST)return reject(res,413)
    const chunks=[];let size=0
    try {
      for await(const chunk of req){size+=chunk.length;if(size>MAX_REQUEST)return reject(res,413);chunks.push(chunk)}
    }catch{return reject(res,400)}
    const headers={'content-type':'application/x-www-form-urlencoded',accept:'application/json','content-length':size}
    // Derive one trusted hop. Never forward caller-supplied XFF/proto/cookies.
    headers['x-forwarded-for']=req.socket.remoteAddress
    headers['x-forwarded-proto']='https'
    if(typeof req.headers.authorization==='string')headers.authorization=req.headers.authorization
    const upstream=http.request({host:'127.0.0.1',port:upstreamPort,path:'/oauth/token',method:'POST',headers,timeout:15000},async reply=>{
      if(reply.statusCode>=300&&reply.statusCode<400){reply.resume();return reject(res,502)}
      if(!reply.headers['content-type']?.toLowerCase().startsWith('application/json')){reply.resume();return reject(res,502)}
      const result=[];let bytes=0
      try {
        for await(const chunk of reply){bytes+=chunk.length;if(bytes>MAX_RESPONSE){reply.destroy();return reject(res,502)}result.push(chunk)}
        const body=Buffer.concat(result);JSON.parse(body.toString('utf8'))
        res.writeHead(reply.statusCode,{'content-type':'application/json','cache-control':'no-store',pragma:'no-cache'});res.end(body)
      }catch{reject(res,502)}
    })
    upstream.on('timeout',()=>upstream.destroy())
    upstream.on('error',()=>reject(res,502))
    res.on('close',()=>{if(!res.writableFinished)upstream.destroy()})
    upstream.end(Buffer.concat(chunks))
  })
  server.maxConnections=64;server.requestTimeout=20000;server.headersTimeout=10000
  server.on('clientError',(_error,socket)=>socket.destroy())
  server.on('tlsClientError',()=>{})
  return server
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const directory='/usr/local/etc/agent-core-native-auth-tls'
  try {
    const server=createTokenProxy({key:readFileSync(directory+'/server.key'),cert:readFileSync(directory+'/server.crt')})
    server.on('error',()=>{process.exitCode=1})
    server.listen(4443,'127.0.0.1')
    const stop=()=>server.close(()=>process.exit(0))
    process.on('SIGTERM',stop);process.on('SIGINT',stop)
  }catch{process.exitCode=1}
}
