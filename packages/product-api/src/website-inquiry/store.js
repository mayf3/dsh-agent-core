import { DatabaseSync } from 'node:sqlite'
import { chmodSync, lstatSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { fail } from './protocol.js'
import { digest } from './codec.js'

/** Single SQLite transaction contains reservation, immutable result and event.
 * BEGIN IMMEDIATE serializes independent runtime handles; FULL durability is
 * required before ATTEMPT_STARTED or the real native ID is acknowledged.
 * No runtime recovery ever deletes records or reopens an attempted request.
 */
export class InquiryStore {
  constructor(file) {
    if (!isAbsolute(file) || !lstatSync(dirname(file)).isDirectory() || lstatSync(dirname(file)).isSymbolicLink()) fail('NOT_PROVISIONED')
    try { if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) fail('NOT_PROVISIONED') } catch (error) { if (error.code !== 'ENOENT') throw error }
    this.db = new DatabaseSync(file)
    try {
      chmodSync(file, 0o600)
      this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;')
      this.db.exec('CREATE TABLE IF NOT EXISTS scopes (id TEXT PRIMARY KEY, state TEXT NOT NULL)')
      this.db.exec('CREATE TABLE IF NOT EXISTS handles (id TEXT PRIMARY KEY, data TEXT NOT NULL)')
      this.db.exec('CREATE TABLE IF NOT EXISTS identities (id TEXT PRIMARY KEY, digest TEXT NOT NULL)')
    } catch (error) { this.db.close(); throw error }
  }
  snapshot(scope) {
    const row = this.db.prepare('SELECT state FROM scopes WHERE id=?').get(scope)
    return row ? JSON.parse(row.state) : { requests: {}, events: [], requestSeq: 0, eventSeq: 0 }
  }
  transaction(scope, callback) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const state = this.snapshot(scope)
      const result = callback(state)
      if (result?.then) throw new TypeError('transaction must be synchronous')
      this.db.prepare('INSERT INTO scopes(id,state) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state')
        .run(scope, JSON.stringify(state))
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
  assertIdentity(entry) {
    const key = digest([entry.human_principal_id, entry.site_project_id, entry.site_owner_id])
    const identity = digest([entry.human_principal_id, entry.communication_scope_id, entry.binding_id])
    this.db.prepare('INSERT OR IGNORE INTO identities(id,digest) VALUES(?,?)').run(key, identity)
    const row = this.db.prepare('SELECT digest FROM identities WHERE id=?').get(key)
    if (row.digest !== identity) fail('BINDING_CHANGED')
  }
  saveHandle(id, data) {
    this.db.prepare('INSERT INTO handles(id,data) VALUES(?,?)').run(id, JSON.stringify(data))
  }
  getHandle(id) {
    const row = this.db.prepare('SELECT data FROM handles WHERE id=?').get(id)
    return row ? JSON.parse(row.data) : null
  }
  close() { this.db.close() }
}
