import * as normalizeSlash from './normalizeSlash';
// @ponicode
describe('normalizeSlash.default', () => {
	test('0', () => {
		const result = normalizeSlash.default('path/to/folder/');
		expect(result).toBe('path/to/folder');
	});
	test('1', () => {
		const result = normalizeSlash.default('path\\to\\folder\\');
		expect(result).toBe('path/to/folder');
	});
	test('2', () => {
		const result = normalizeSlash.default('E:');
		expect(result).toBe('E:/');
	});
	test('3', () => {
		const result = normalizeSlash.default('E:/');
		expect(result).toBe('E:/');
	});
});
