import fs from 'node:fs';
import crypto from 'node:crypto';

function extractBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (/^test\(/.test(lines[i])) {
      const start = i;
      let j = i;
      let found = false;
      while (j < lines.length) {
        if (lines[j] === '});' || lines[j] === '})') { found = true; break; }
        j++;
      }
      if (!found) throw new Error('unterminated block at line ' + (start + 1));
      // block = lines[start..j] inclusive + trailing newline
      blocks.push({ name: lines[i], startLine: start + 1, endLine: j + 1, bytes: lines.slice(start, j + 1).join('\n') + '\n' });
      i = j + 1;
    } else i++;
  }
  return blocks;
}

const oldText = fs.readFileSync(process.argv[2], 'utf8');
const oldBlocks = extractBlocks(oldText);
const newBlocks = [];
for (const f of process.argv.slice(3)) {
  const t = fs.readFileSync(f, 'utf8');
  for (const b of extractBlocks(t)) { b.file = f; newBlocks.push(b); }
}
const nameOf = (s) => s.match(/^test\('((?:[^'\\]|\\.)*)'/)?.[1] ?? s;

console.log('OLD_BLOCKS=' + oldBlocks.length + ' NEW_BLOCKS=' + newBlocks.length);
const oldNames = oldBlocks.map((b) => nameOf(b.name));
const newNames = newBlocks.map((b) => nameOf(b.name));
console.log('NAME_SETS_EQUAL=' + (JSON.stringify([...new Set(oldNames)].sort()) === JSON.stringify([...new Set(newNames)].sort())));
console.log('OLD_ORDER_PRESERVED_IN_NEW=' + (JSON.stringify(newNames) === JSON.stringify(oldNames)));

// byte multiset compare
const sig = (b) => crypto.createHash('sha256').update(b.bytes).digest('hex');
const oldSigs = oldBlocks.map(sig).sort();
const newSigs = newBlocks.map(sig).sort();
let byteIdentical = oldSigs.length === newSigs.length && oldSigs.every((s, k) => s === newSigs[k]);
console.log('BYTE_IDENTICAL_MULTISET=' + byteIdentical);
if (!byteIdentical) {
  const oldMap = new Map(); oldSigs.forEach((s) => oldMap.set(s, (oldMap.get(s) ?? 0) + 1));
  const newMap = new Map(); newSigs.forEach((s) => newMap.set(s, (newMap.get(s) ?? 0) + 1));
  for (const [s, c] of oldMap) if ((newMap.get(s) ?? 0) !== c) console.log('MISMATCH_OLD_ONLY ' + s);
  for (const [s, c] of newMap) if ((oldMap.get(s) ?? 0) !== c) console.log('MISMATCH_NEW_ONLY ' + s);
}
// per-block pairing (by name order) sha + per-file distribution
console.log('--- per-block sha256 (old order) ---');
oldBlocks.forEach((b, k) => console.log(String(k + 1).padStart(2) + ' ' + sig(b).slice(0, 16) + ' :L' + b.startLine + '-' + b.endLine + ' ' + nameOf(b.name)));
console.log('--- per-block sha256 (new, file order) ---');
newBlocks.forEach((b, k) => console.log(String(k + 1).padStart(2) + ' ' + sig(b).slice(0, 16) + ' ' + b.file.split('/').pop() + ' :L' + b.startLine + '-' + b.endLine + ' ' + nameOf(b.name)));
// concatenated sha in old order and in new order
const catOld = crypto.createHash('sha256').update(oldBlocks.map((b) => b.bytes).join('')).digest('hex');
const catNew = crypto.createHash('sha256').update(newBlocks.map((b) => b.bytes).join('')).digest('hex');
console.log('CONCAT_SHA_OLD=' + catOld);
console.log('CONCAT_SHA_NEW=' + catNew);
