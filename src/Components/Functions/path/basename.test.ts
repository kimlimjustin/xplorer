import * as basename from './basename';
// @ponicode
describe('basename.default', () => {
	test('0', () => {
		const result = basename.default('path/to/file.ext');
		expect(result).toBe('file.ext');
	});

	test('1', () => {
		const result = basename.default('path/to/folder/');
		expect(result).toBe('folder');
	});

	test('2', () => {
		const result = basename.default('/path/to/file');
		expect(result).toBe('file');
	});

	test('4', () => {
		const result = basename.default('C:\\\\path\\to\\folder\\');
		expect(result).toBe('folder');
	});
});
