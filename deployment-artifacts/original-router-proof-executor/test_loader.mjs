import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import processes from 'node:child_process'
import * as cachedFS from 'node:fs'
import * as cachedProcesses from 'node:child_process'
import * as url from 'node:url'
import { syncBuiltinESMExports } from 'node:module'
import { memoryModule } from './memory_loader.mjs'

test('exact-memory loader rejects fallback through success/error and cleanup', async () => {
  const calls=[], originals=[]
  const promises=fs.promises
  for (const object of [fs,promises,processes]) {
    const names=Object.keys(object).filter(name=>typeof object[name] === 'function')
    for (const name of names) {
      originals.push([object,name,Object.getOwnPropertyDescriptor(object,name)])
      Object.defineProperty(object,name,{configurable:true,enumerable:true,writable:true,
        value:(...args)=>{calls.push(name);throw new Error('HARD_DENY')}})
    }
  }
  syncBuiltinESMExports()
  try {
    const originalURL='file:///virtual/exact/own-target.mjs'
    const normal=await memoryModule('export const url=import.meta.url',originalURL,new Map())
    assert.equal(normal.url,originalURL)
    await assert.rejects(memoryModule('throw new Error("OWN_FAILURE")',originalURL,new Map()),/OWN_FAILURE/)
    await assert.rejects(memoryModule('import "node:unprepared"',originalURL,new Map()),/MEMORY_IMPORT_DENIED/)
    await assert.rejects(memoryModule('import "./unknown-file.mjs"',originalURL,new Map()),/MEMORY_IMPORT_DENIED/)
    const cached=await memoryModule('import {pathToFileURL} from "node:url";export const value=pathToFileURL("/virtual").href',originalURL,new Map([['node:url',url]]))
    assert.equal(cached.value,'file:///virtual')
    assert.deepEqual(calls,[])
    const guarded=await memoryModule(`
      import filesystem,{openSync,readSync} from 'node:fs';
      import processes,{spawn} from 'node:child_process';
      export function check(){for(const f of [openSync,filesystem.openSync,readSync,filesystem.readSync,spawn,processes.spawn]){
        try{f('/virtual')}catch(e){if(e.message!=='HARD_DENY')throw e}
      }}
    `,originalURL,new Map([['node:fs',cachedFS],['node:child_process',cachedProcesses]]))
    guarded.check()
    assert.deepEqual(calls,['openSync','openSync','readSync','readSync','spawn','spawn'])
    // Cleanup still runs inside the same denial boundary.
    assert.throws(()=>fs.openSync('/virtual/cleanup'),/HARD_DENY/)
    assert.throws(()=>processes.spawn('not-executed'),/HARD_DENY/)
    assert.deepEqual(calls,['openSync','openSync','readSync','readSync','spawn','spawn','openSync','spawn'])
  } finally {
    for (const [o,n,v] of originals) Object.defineProperty(o,n,v)
    syncBuiltinESMExports()
  }
})
