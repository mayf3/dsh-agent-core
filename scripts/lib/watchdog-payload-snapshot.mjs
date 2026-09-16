/**
 * Frozen payload manifest for the Scheduler Watchdog deployment overlay.
 *
 * Generated once from the reviewed payload commit 24e48e52a61be4eb484c702bc4
 * 68dadcaf5e8de7 (WATCHDOG_PAYLOAD_SHA provenance) whose tree is byte-identical
 * to the merged main candidate 9ad955891e1c15c041ca2c4bf4e1c451769157d4 for
 * every listed path (git diff between the two over these paths is empty —
 * verified 2026-09-16).
 *
 * Why a content snapshot instead of the commit pin: plan/apply must resolve
 * the exact reviewed bytes from the SOURCE_SHA tree of ANY checkout that
 * contains SOURCE_SHA — including shallow (`--depth 1`) fresh main-only
 * clones, where the deep-history pin commit is unreachable (`bad object`).
 * Resolution is `git show SOURCE_SHA:<path>` with a sha256 assertion against
 * THIS snapshot, so reviewed bytes cannot drift: any source change to a listed
 * file fails overlay() closed and forces an explicit reviewed snapshot
 * regeneration.
 */
export const WATCHDOG_PAYLOAD_SNAPSHOT = {
  base: '68008e83142bdb637c4fa61c2a65db73c64b2eb1',
  payloadCommit: '24e48e52a61be4eb484c702bc468dadcaf5e8de7',
  paths: {
    'packages/product-api/src/index.js': 'bc4e47682e4a91b3a96692488f4480620b29579e463017c07ce8249ac4f0e0d8',
    'packages/product-api/src/scheduler-health-routes.js': '8c04161f807f17aafb4a0cb265ea07b5f95a908b1ad735602f00f33c8a9ece5d',
    'packages/production-runtime/src/compose.js': 'e2db2d91d977e3c91c4030a6e95d8af723d2741b6281b58bf4adc119d2f65422',
    'packages/production-runtime/src/entry.js': 'b8b1812ca9fe9c0cd557366a3cafb117cdd72f4da260b3e002da1a663d129182',
    'packages/production-runtime/src/paths.js': '83b7862d8a3cdad70e9c12fe1d4ae0b75eab6cd23209a05fe3bad45c4b80977a',
    'packages/production-runtime/src/scheduler-invoker.js': 'f05f647177cae09795a13c60cef6ead2eee9832457febcc3eb496285e8023414',
    'packages/production-runtime/src/scheduler/deployment-canary-control.js': 'd226b9b8c53e97438ab5aab5e13c07d1b2396a654e1961e0104664c7bcf59ef4',
    'packages/production-runtime/src/scheduler/health-runtime.js': '49c2fb7b77e6d5bfe8d38e3c66c613b527f83a3bed110eb95c6d8000201c694a',
    'packages/production-runtime/src/scheduler/self-service-runtime.js': 'acfde749a7c2c9201cc6270c4829c1267ce94d995b5610f39a64da64d2101df0',
    'packages/scheduler/src/index.js': '9ded6900d6f60b1f50c04a5327a5d1b4dd92b31ca7816f34707198a3432c705d',
    'packages/scheduler/src/self-ops/index.js': '766abb782cb736a89ad743a0d14ffb4092055207f2d7cfe75b85f6f79e2ab196',
    'packages/scheduler/src/watchdog/delivery.js': '352060c4967fc9e143562c4dff80cbe7172839650252c9d3bc5195ac277598bf',
    'packages/scheduler/src/watchdog/durable-state.js': 'a0bae637f5c73750964334d90f02fc0dab742558e826473ef10813e2eb5d2835',
    'packages/scheduler/src/watchdog/health.js': 'ab5aab07f6cdae61b173ab0c925d829c99416091985a8eb455ae90c798b625a3',
    'packages/scheduler/src/watchdog/incident-compiler.js': 'b4d0f02609468cffcc131fd28213ed6f599ae4caeb925e51fabb06e8cab807ed',
    'packages/scheduler/src/watchdog/incident-lifecycle.js': 'dbce9a4d32fe2175a3ef37fe6991c114286bbd5187ba258b496f897ba677265a',
    'packages/scheduler/src/watchdog/index.js': 'b005173af37c449de00cb4357a13637f78c816b8cfc2f3239724a0a8a3645c49',
    'packages/scheduler/src/watchdog/private-state-io.js': '456227694c20e51158625e7dfdf40ce867a0b37b60cff8025af85ea78dba1f6b',
    'packages/scheduler/src/watchdog/reconciliation.js': '3d1d31b6997e6c461ae8124bdf183e256e28630dcc930d5e5e01e666b8564aaa',
    'packages/scheduler/src/watchdog/routing.js': '91ec8516dedb2ac4f001434cbe5baa32fd8c0f3508e3256fa6d5c91d02334547',
    'scripts/scheduler-watchdog.mjs': 'f84f974953954898aef49e4f4ed8f63639ad8109dcb3b75b97b09d4146990d6a',
  },
}
