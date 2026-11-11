/** Test-only confinement: fail any file I/O outside owned mkdtemp roots/code. */
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
for (const key of ['DSH_PRIMARY_WORKSPACE','DSH_AGENT_ID','DSH_WORKSPACE_DIR']) delete process.env[key]
const installed = Symbol.for('agent-memory.test-fs-audit')
if (!globalThis[installed]) {
  globalThis[installed] = true
  const originalRealpath = fs.realpathSync
  const originalMkdtemp = fs.promises.mkdtemp.bind(fs.promises)
  const roots = new Set()
  const codeRoots = [resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..'),'/usr/local/libexec/agent-core/harness','/usr/local/libexec/agent-core/app/node_modules']
  const contains = (root,path) => {const part=relative(root,path);return part==='' || (!isAbsolute(part) && part!=='..' && !part.startsWith(`..${sep}`))}
  const pathString = value => resolve(value instanceof URL ? fileURLToPath(value) : String(value))
  const check = (value,write) => {
    if (typeof value === 'number') return
    const path=pathString(value)
    if ([...roots,...(write ? [] : codeRoots)].some(root=>contains(root,path))) return
    throw Object.assign(new Error('TEST_FS_OUTSIDE_OWNED_ROOT'),{code:'TEST_FS_OUTSIDE_OWNED_ROOT'})
  }
  fs.promises.mkdtemp=async(prefix,...args)=>{
    if (!contains(tmpdir(),pathString(prefix))) throw new Error('TEST_TMP_OUTSIDE_TEMPDIR')
    const root=await originalMkdtemp(prefix,...args)
    roots.add(resolve(root));roots.add(originalRealpath(root))
    return root
  }
  const reads=['readFile','readdir','stat','lstat','realpath','access','readlink']
  const writes=['writeFile','appendFile','mkdir','rm','rmdir','unlink','chmod','chown','truncate','utimes']
  for (const [names,write] of [[reads,false],[writes,true]]) for (const name of names) {
    if (fs.promises[name]) {const original=fs.promises[name].bind(fs.promises);fs.promises[name]=async(path,...args)=>{check(path,write);return original(path,...args)}}
    const sync=`${name}Sync`
    if (fs[sync]) {const original=fs[sync].bind(fs);fs[sync]=(path,...args)=>{check(path,write);return original(path,...args)}}
  }
  for (const name of ['rename','copyFile']) {
    const original=fs.promises[name].bind(fs.promises)
    fs.promises[name]=async(from,to,...args)=>{check(from,true);check(to,true);return original(from,to,...args)}
  }
  const open=fs.promises.open.bind(fs.promises)
  fs.promises.open=async(path,flags,...args)=>{check(path,typeof flags === 'number' ? Boolean(flags & (fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT)) : /[wa+]/.test(flags));return open(path,flags,...args)}
  const symlink=fs.promises.symlink.bind(fs.promises)
  fs.promises.symlink=async(target,path,...args)=>{check(path,true);return symlink(target,path,...args)}
  syncBuiltinESMExports()
}
