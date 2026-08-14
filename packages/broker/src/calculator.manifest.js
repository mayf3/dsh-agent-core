/**
 * @agent-core/broker — `external.calculator` capability (V1).
 *
 * The calculator capability, now expressed as MANIFEST DATA (the contract
 * surface: wire id, operations, per-operation parameter/result schemas, the
 * error-code table, descriptions) plus a separate code-side handler map (the
 * execution logic). This is the V0 fixture, upgraded from hard-coded
 * registration to manifest-driven data. Semantics are preserved 1:1.
 *
 * History (V0 acceptance): `external.calculator` + { operation:"multiply",
 * a:6, b:7 } -> result 42. Operation enum add|subtract|multiply|divide;
 * success { ok:true, result }, failure { ok:false, error:{ code:
 * invalid_arguments | unsupported_operation | divide_by_zero } }.
 */

/** Pure contract-surface data (JSON-serializable; NO functions). */
export const manifest = {
  id: 'external.calculator',
  toolName: 'external_calculator',
  name: 'Calculator',
  description:
    'Agent Core capability `external.calculator` (external-harness-v1 calculator): ' +
    'perform one arithmetic operation on two numbers. ' +
    'Returns {ok: true, result: <number>} on success, or {ok: false, error: {code}} on failure. ' +
    'Do not use any other tool for arithmetic.',
  errors: [
    { code: 'invalid_arguments', description: 'Arguments did not satisfy the operation schema.' },
    { code: 'unsupported_operation', description: 'The requested operation is not supported by this capability.' },
    { code: 'divide_by_zero', description: 'Division by zero is undefined.' },
  ],
  operations: [
    {
      name: 'add',
      description: 'Return a + b.',
      arguments: {
        properties: {
          a: { type: 'number', required: true, description: 'First operand.' },
          b: { type: 'number', required: true, description: 'Second operand.' },
        },
        required: ['a', 'b'],
      },
      result: { type: 'number' },
      errors: ['invalid_arguments'],
    },
    {
      name: 'subtract',
      description: 'Return a - b.',
      arguments: {
        properties: {
          a: { type: 'number', required: true, description: 'First operand.' },
          b: { type: 'number', required: true, description: 'Second operand.' },
        },
        required: ['a', 'b'],
      },
      result: { type: 'number' },
      errors: ['invalid_arguments'],
    },
    {
      name: 'multiply',
      description: 'Return a * b. This is the accepted V0 fixture operation (6 × 7 = 42).',
      arguments: {
        properties: {
          a: { type: 'number', required: true, description: 'First operand.' },
          b: { type: 'number', required: true, description: 'Second operand.' },
        },
        required: ['a', 'b'],
      },
      result: { type: 'number' },
      errors: ['invalid_arguments'],
    },
    {
      name: 'divide',
      description: 'Return a / b; division by zero yields divide_by_zero.',
      arguments: {
        properties: {
          a: { type: 'number', required: true, description: 'Dividend.' },
          b: { type: 'number', required: true, description: 'Divisor (must be non-zero).' },
        },
        required: ['a', 'b'],
      },
      result: { type: 'number' },
      errors: ['invalid_arguments', 'divide_by_zero'],
    },
  ],
}

/**
 * Code-side execution logic for the calculator capability. Plain pure
 * functions keyed by operation name. Signature:
 *   handler(operation, args, principal) -> result | { errorCode }
 * The mapping layer wraps returns in the { ok, ... } wire envelope and
 * validates codes against the manifest error table.
 */
export const handlers = {
  add: (_op, args) => args.a + args.b,
  subtract: (_op, args) => args.a - args.b,
  multiply: (_op, args) => args.a * args.b,
  divide: (_op, args) =>
    args.b === 0 ? { errorCode: 'divide_by_zero' } : args.a / args.b,
}
