import os from 'node:os'
import { syncBuiltinESMExports } from 'node:module'
const isolated = process.env.HR953_ISOLATED_OS_HOME
if (!isolated || !isolated.startsWith('/private/tmp/hr953-validation-')) throw new Error('HR953 isolated os.homedir guard missing')
os.homedir = () => isolated
syncBuiltinESMExports()
