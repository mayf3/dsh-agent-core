import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
import { appendFileSync } from 'node:fs';
const allowed = host => ['127.0.0.1','localhost','::1','[::1]'].includes(String(host));
const denied = host => {
  appendFileSync(new URL('./network-denials.ndjson', import.meta.url), JSON.stringify({pid:process.pid,host:String(host)})+'\n');
  throw new Error('FIXTURE_EXTERNAL_NETWORK_DENIED');
};
const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  const first=Array.isArray(args[0])?args[0][0]:args[0];
  const opts=first && typeof first==='object' ? first : {port:first,host:typeof args[1]==='string'?args[1]:'localhost'};
  if (opts.path) return denied('unix-socket');
  const host=opts.host ?? opts.hostname ?? 'localhost';
  if (!allowed(host)) {
    if (typeof opts.lookup !== 'function') return denied(host);
    const originalLookup=opts.lookup;
    opts.lookup=function(hostname, options, callback) {
      return originalLookup(hostname, options, (error, address, family) => {
        if (error) return callback(error);
        const addresses=Array.isArray(address)?address.map(value=>value.address):[address];
        if (!addresses.length || !addresses.every(allowed)) {
          try { denied(hostname); } catch (failure) { return callback(failure); }
        }
        callback(null,address,family);
      });
    };
  }
  return socketConnect.apply(this,args);
};
const originalFetch=globalThis.fetch;
globalThis.fetch = function(input,init) {
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if (!allowed(url.hostname)) return denied(url.hostname);
  return originalFetch(input,init);
};
syncBuiltinESMExports();
