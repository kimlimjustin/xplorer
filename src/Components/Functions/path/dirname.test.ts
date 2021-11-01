import * as dirname from './dirname';
// @ponicode
describe('dirname.default', () => {
	test('0', () => {
		const result = dirname.default('/path/to/file');
		expect(result).toBe('/path/to/');
	});

	test('1', () => {
		const result = dirname.default('path/to/file.ext');
		expect(result).toBe('path/to/');
	});

	test('2', () => {
		const result = dirname.default('path/to/folder/');
		expect(result).toBe('path/to/');
	});

	test('3', () => {
		const result = dirname.default('./path/to/file');
		expect(result).toBe('./path/to/');
	});

	test('4', () => {
		const result = dirname.default('C:\\\\path\\to\\folder\\');
		expect(result).toBe('C:\\\\path\\to/');
	});
});
