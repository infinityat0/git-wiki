/*
 * Public surface of the U7 auth UI. The integrator wires these at the app root:
 *   `import { SignInGate, UserChip, IfCanWrite } from '../components/Auth'`.
 */

export { SignInGate, default as SignInGateDefault } from './SignInGate.js';
export type { SignInGateProps } from './SignInGate.js';
export { UserChip, default as UserChipDefault } from './UserChip.js';
export { IfCanWrite, default as IfCanWriteDefault } from './IfCanWrite.js';
export type { IfCanWriteProps } from './IfCanWrite.js';
