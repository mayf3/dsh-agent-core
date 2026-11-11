"""Inventory and one-process nofollow xattrs; _xattrs_map is a reserved key.

Hex long listings bind each attribute to a known full path. Ambiguous paths or
unrecognized output abort; no sentinel can enter an equality comparison.
"""
from window_helper_core import P, digest, hashlib, json, meta, os, re, require, run, effect_guard

XATTRS_KEY = '_xattrs_map'


def extended(p):
    s=P(p).lstat()
    return {'flags':getattr(s,'st_flags',0)}


def parse_xattrs(data, paths):
    rows={}; current=None; value=bytearray(); ended=True
    for line in data.decode('utf-8',errors='strict').splitlines():
        if not line: continue
        if ': ' in line and not re.match(r'^[0-9A-Fa-f]{8,}  ',line):
            require(ended,'unterminated xattr hex value: '+str(current))
            path,name=line.rsplit(': ',1)
            require(path in paths and re.fullmatch(r'[A-Za-z0-9._-]+:',name),
                    'unbound/ambiguous xattr header: '+repr(line))
            key=paths[path]; name=name[:-1]
            require(name not in rows.get(key,{}),'duplicate xattr: '+path+' '+name)
            current=(key,name); value=bytearray(); ended=False
            continue
        require(current is not None and not ended,'unbound xattr data: '+repr(line))
        if re.fullmatch(r'[0-9A-Fa-f]{8,}',line):
            require(int(line,16)==len(value),'xattr hex length mismatch: '+str(current))
            key,name=current; rows.setdefault(key,{})[name]=bytes(value); ended=True
            continue
        m=re.fullmatch(r'([0-9A-Fa-f]{8,})  (.*?) +\|.*\|',line)
        require(m is not None,'unparseable xattr hex: '+repr(line))
        require(int(m[1],16)==len(value),'xattr hex offset mismatch: '+str(current))
        octets=m[2].split()
        require(1<=len(octets)<=16 and all(re.fullmatch('[0-9A-Fa-f]{2}',x) for x in octets),
                'invalid xattr hex bytes: '+str(current))
        value.extend(bytes.fromhex(''.join(octets)))
    require(ended,'unterminated xattr hex value: '+str(current))
    return rows


def xattr_values(root):
    root=P(root).absolute()
    require(root.is_dir() and not root.is_symlink(),'xattr root must be a physical directory: '+str(root))
    paths={str(root):'.'}
    def walk_error(error): raise error
    for base,dirs,files in os.walk(root,followlinks=False,onerror=walk_error):
        for name in dirs+files:
            p=P(base)/name; paths[str(p)]=str(p.relative_to(root))
    for path,rel in paths.items():
        require(not any(ord(c)<32 or ord(c)==127 for c in path) and ': ' not in path,
                'ambiguous xattr path: '+repr(path))
        require(rel!=XATTRS_KEY,'reserved inventory path: '+path)
        path.encode('utf-8',errors='strict')
    # -r is one tree-wide process, -s never follows even dangling/absolute links,
    # -x avoids lossy CLI string rendering (including binary NUL and empty data).
    out=run(['/usr/bin/xattr','-lrsx',root],timeout=3600)
    require(not out.stderr,'xattr diagnostic for '+str(root)+': '+out.stderr.decode(errors='replace'))
    return parse_xattrs(out.stdout,paths)


def xattr_map(values):
    return {k:hashlib.sha256(json.dumps({name:data.hex() for name,data in attrs.items()},
                sort_keys=True,separators=(',',':')).encode()).hexdigest()
            for k,attrs in values.items()}


def inventory(root,metadata=True):
    result={}
    if metadata:
        m=meta(root); result['.']={'kind':'dir',**{k:m[k] for k in ('uid','gid','mode')},**extended(root)}
    for base,dirs,files in os.walk(root,followlinks=False):
        for n in sorted(dirs+files):
            p=P(base)/n; k=str(p.relative_to(root)); m=meta(p)
            if p.is_symlink(): row={'kind':'link','target':os.readlink(p)}
            elif p.is_dir(): row={'kind':'dir'}
            elif p.is_file(): row={'kind':'file','sha256':digest(p)}
            else: raise RuntimeError('unsupported special file '+str(p))
            if metadata:
                row.update({k:m[k] for k in ('uid','gid','mode')}); row.update(extended(p))
            result[k]=row
    require(XATTRS_KEY not in result,'reserved inventory path: '+str(P(root)/XATTRS_KEY))
    result[XATTRS_KEY]=xattr_map(xattr_values(root))
    return result


def reconcile_xattrs(source,target,expected):
    before=xattr_values(source); after=xattr_values(target)
    require(xattr_map(before)==expected,'source xattrs drifted before preimage reconciliation: '+str(source))
    repairs=[]; differences=[]
    for rel in sorted(set(before)|set(after)):
        a=before.get(rel,{}); b=after.get(rel,{})
        for name in sorted(set(a)|set(b)):
            if name in a and name in b and a[name]==b[name]: continue
            if name in a and name not in b and a[name]==b'': repairs.append((rel,name))
            else: differences.append({'path':rel,'attribute':name,'sourcePresent':name in a,'targetPresent':name in b})
    # Inspect ALL differences before writing even one allowed empty attribute.
    require(not differences,'nonempty/unexpected preimage xattr differences: '+json.dumps(differences))
    for rel,name in repairs:
        path=P(target) if rel=='.' else P(target)/rel
        require(os.path.lexists(path),'missing empty-xattr target: '+str(path))
        # Refuse a symlink ancestor; leaf itself uses -s and is never followed.
        for parent in path.relative_to(target).parents:
            require(not (P(target)/parent).is_symlink(),'symlink ancestor in xattr repair: '+str(path))
        effect_guard('xattr.write',str(path),{'name':name,'valueHex':''})
        run(['/usr/bin/xattr','-s','-w',name,'',path])
        print('EMPTY_XATTR_REAPPLIED '+json.dumps({'path':str(path),'attribute':name},sort_keys=True))
    require(xattr_map(xattr_values(target))==expected,'preimage xattrs differ after empty-value reapply: '+str(target))
    return repairs
