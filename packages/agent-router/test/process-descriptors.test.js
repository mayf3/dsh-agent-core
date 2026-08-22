/**
 * PR #42 structure-review B-1 regression: the prototype composition of the
 * split method groups must preserve the pre-refactor class prototype
 * descriptors exactly. Plain `Object.assign(proto, group)` installs the
 * groups' plain-object descriptors verbatim (enumerable: true), flipping the
 * frozen-audit 40 AgentProcess + 12 TurnReconciliationStore methods away from
 * the pre-refactor class-prototype shape. These tests pin every own method
 * (composed and class-body alike) to enumerable: false / writable: true /
 * configurable: true, pin the audited composition counts, and confirm the
 * `constructor` property is never overwritten by a group.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { AgentProcess } from '../src/process.js'
import { TurnReconciliationStore } from '../src/reconciliation-store.js'
import { stateMachineMethods } from '../src/process/state-machine.js'
import { evidenceBufferMethods } from '../src/process/evidence-buffer.js'
import { rpcChannelMethods } from '../src/process/rpc-channel.js'
import { eventCorrelationMethods } from '../src/process/event-correlation.js'
import { turnExecutionMethods } from '../src/process/turn-execution.js'
import { spawnMethods } from '../src/process/spawn.js'
import { shutdownMethods } from '../src/process/shutdown.js'
import { settlementMethods } from '../src/reconciliation/state-machine.js'
import { queryMethods } from '../src/reconciliation/query.js'

const METHOD_COUNT_AGENT_PROCESS = 40
const METHOD_COUNT_RECONCILIATION = 12

function composedKeys(groups) {
  const keys = new Set()
  for (const group of groups) {
    for (const key of Object.keys(group)) {
      if (key !== 'constructor') keys.add(key)
    }
  }
  return keys
}

function ownMethodNames(klass) {
  return Object.getOwnPropertyNames(klass.prototype).filter((key) => key !== 'constructor')
}

function assertDescriptorShape(klass, label) {
  const own = ownMethodNames(klass)
  assert.ok(own.length > 0, `${label}: expected own prototype methods`)
  for (const key of own) {
    const descriptor = Object.getOwnPropertyDescriptor(klass.prototype, key)
    assert.equal(descriptor.enumerable, false, `${label}.${key}.enumerable`)
    assert.equal(descriptor.configurable, true, `${label}.${key}.configurable`)
    // `events` is a getter (accessor) in the pre-refactor shape; every other
    // own member is a data method. Accessors carry no writable axis.
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      assert.equal(typeof (descriptor.get ?? descriptor.set), 'function', `${label}.${key}: accessor must keep a function get/set`)
    } else {
      assert.equal(descriptor.writable, true, `${label}.${key}.writable`)
    }
  }
  assert.equal(klass.prototype.constructor, klass, `${label}: prototype.constructor identity`)
  return own
}

test('AgentProcess prototype method descriptors preserved (B-1: enumerable false, composition complete)', () => {
  const composed = composedKeys([
    stateMachineMethods,
    evidenceBufferMethods,
    rpcChannelMethods,
    eventCorrelationMethods,
    turnExecutionMethods,
    spawnMethods,
    shutdownMethods,
  ])
  assert.equal(composed.size, METHOD_COUNT_AGENT_PROCESS, 'frozen-audit AgentProcess composed method count')

  const own = assertDescriptorShape(AgentProcess, 'AgentProcess')
  for (const key of composed) {
    assert.ok(own.includes(key), `composed method missing from AgentProcess.prototype: ${key}`)
  }
})

test('TurnReconciliationStore prototype method descriptors preserved (B-1: enumerable false, composition complete)', () => {
  const composed = composedKeys([settlementMethods, queryMethods])
  assert.equal(composed.size, METHOD_COUNT_RECONCILIATION, 'frozen-audit TurnReconciliationStore composed method count')

  const own = assertDescriptorShape(TurnReconciliationStore, 'TurnReconciliationStore')
  for (const key of composed) {
    assert.ok(own.includes(key), `composed method missing from TurnReconciliationStore.prototype: ${key}`)
  }
})
