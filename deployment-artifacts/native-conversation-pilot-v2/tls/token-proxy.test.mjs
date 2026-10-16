import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync,execFile} from 'node:child_process'
import {promisify} from 'node:util'

test('proposed TLS sidecar preserves the actual POST client_credentials wire and rejects other routes', async () => {
  let implementation
  try { implementation = await import('./token-proxy.mjs') } catch {}
  assert.equal(typeof implementation?.createTokenProxy, 'function', 'TLS proxy implementation must exist')
  const dir=await mkdtemp(join(tmpdir(),'pilot1156-tls-fixture-'))
  let proxy, upstream
  try {
    execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Pilot1156 fixture CA',
      '-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign',
      '-keyout',join(dir,'ca.key'),'-out',join(dir,'ca.pem')],{stdio:'ignore'})
    execFileSync('/usr/bin/openssl',['req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1',
      '-keyout',join(dir,'key.pem'),'-out',join(dir,'leaf.csr')],{stdio:'ignore'})
    await writeFile(join(dir,'leaf.ext'),'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n')
    execFileSync('/usr/bin/openssl',['x509','-req','-days','1','-in',join(dir,'leaf.csr'),'-CA',join(dir,'ca.pem'),
      '-CAkey',join(dir,'ca.key'),'-CAcreateserial','-extfile',join(dir,'leaf.ext'),'-out',join(dir,'cert.pem')],{stdio:'ignore'})
    const key=await readFile(join(dir,'key.pem')),cert=await readFile(join(dir,'cert.pem')),ca=await readFile(join(dir,'ca.pem'))
    const calls=[];let redirect=false
    upstream=http.createServer(async(req,res)=>{
      const chunks=[];for await(const chunk of req)chunks.push(chunk)
      calls.push({url:req.url,method:req.method,authorization:req.headers.authorization,body:Buffer.concat(chunks).toString(),forwarded:req.headers['x-forwarded-for']??null,proto:req.headers['x-forwarded-proto']??null,cookie:req.headers.cookie??null})
      if(redirect){res.writeHead(307,{location:'/elsewhere','content-type':'application/json'});res.end('{}');return}
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({access_token:'fixture-token',token_type:'Bearer',expires_in:60}))
    })
    await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve))
    proxy=implementation.createTokenProxy({key,cert,upstreamPort:upstream.address().port})
    await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve))
    const request=(method,path,body='',extra={},tlsExtra={})=>new Promise((resolve,reject)=>{
      const req=https.request({host:'127.0.0.1',port:proxy.address().port,path,method,ca,
        ...tlsExtra,headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic Zml4dHVyZTpmaXh0dXJl',...extra}},async res=>{
          const chunks=[];for await(const chunk of res)chunks.push(chunk)
          resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()})
        });req.on('error',reject);req.end(body)
    })
    const body='grant_type=client_credentials&resource=agent-core-mcp-conversation-v1&scope=conversation.access'
    const result=await request('POST','/oauth/token',body,{'x-forwarded-for':'untrusted','cookie':'private-fixture'})
    assert.equal(result.status,200);assert.equal(JSON.parse(result.body).token_type,'Bearer')
    assert.deepEqual(calls,[{url:'/oauth/token',method:'POST',authorization:'Basic Zml4dHVyZTpmaXh0dXJl',body,forwarded:'127.0.0.1',proto:'https',cookie:null}])
    assert.equal(result.headers['cache-control'],'no-store')
    assert.equal(result.headers.pragma,'no-cache')
    assert.equal((await request('GET','/oauth/token')).status,404)
    assert.equal((await request('POST','/api/admin',body)).status,404)
    assert.equal((await request('POST','/oauth/token?redirect=1',body)).status,404)
    assert.equal((await request('POST','/oauth/token',body,{'content-type':'application/json'})).status,415)
    assert.equal((await request('POST','/oauth/token','x'.repeat(16385))).status,413)
    assert.equal(calls.length,1,'rejected requests must never reach auth-service')
    await assert.rejects(request('POST','/oauth/token',body,{}, {ca:undefined}),/self-signed|certificate|issuer/i)
    await assert.rejects(request('POST','/oauth/token',body,{}, {servername:'wrong.example'}),/hostname|IP|altnames/i)
    assert.equal(calls.length,1,'TLS failures make no upstream request')
    redirect=true
    assert.equal((await request('POST','/oauth/token',body)).status,502)
    assert.equal(calls.length,2,'redirect must be rejected without retry')
    redirect=false
    const childEnv={PATH:process.env.PATH,NODE_OPTIONS:'',NODE_USE_ENV_PROXY:'0',HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:''}
    const program=`try{const response=await fetch(process.argv[1],{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic Zml4dHVyZTpmaXh0dXJl'},body:${JSON.stringify(body)},signal:AbortSignal.timeout(3000)});const value=await response.json();process.stdout.write(JSON.stringify({status:response.status,valid:typeof value.access_token==='string'&&value.token_type==='Bearer'&&Number.isInteger(value.expires_in)}))}catch{process.exitCode=2}`
    const url=`https://127.0.0.1:${proxy.address().port}/oauth/token`
    const child=await promisify(execFile)(process.execPath,['--input-type=module','-e',program,url],{env:{...childEnv,NODE_EXTRA_CA_CERTS:join(dir,'ca.pem')}})
    assert.deepEqual(JSON.parse(child.stdout),{status:200,valid:true})
    await assert.rejects(promisify(execFile)(process.execPath,['--input-type=module','-e',program,url],{env:childEnv}),e=>e.code===2)
    assert.equal(calls.length,3,'same Node fetch loads explicit CA; no-CA control cannot reach auth')
  } finally {
    if(proxy)await new Promise(resolve=>proxy.close(resolve))
    if(upstream)await new Promise(resolve=>upstream.close(resolve))
    await rm(dir,{recursive:true,force:true})
  }
})
