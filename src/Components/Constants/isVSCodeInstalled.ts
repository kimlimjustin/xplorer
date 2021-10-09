/* eslint-disable no-empty */
import { execSync } from 'child_process';

let vscodeInstalled = false;
try {
	execSync('code --version');
	vscodeInstalled = true;
} catch (_) {}

export default vscodeInstalled;
