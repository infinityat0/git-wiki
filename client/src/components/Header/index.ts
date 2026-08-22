/*
 * Public surface of the U5 header. The integrator fills the Shell's `header`
 * slot with this and wires `onMenuClick` to U1's sidebar drawer:
 *   `import { Header } from '../components/Header'`.
 */

export { Header, default, type HeaderProps } from './Header.js';
