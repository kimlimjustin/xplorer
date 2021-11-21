import * as filesize from './filesize';
// @ponicode
describe('filesize.default', () => {
	test('0', () => {
		const result = filesize.default(1024);
		expect(result).toBe('1 KB');
	});

	test('1', () => {
		const result = filesize.default(102);
		expect(result).toBe('102 Bytes');
	});

	test('2', () => {
		const result = filesize.default(2097052);
		expect(result).toBe('2 MB');
	});

	test('3', () => {
		const result = filesize.default(1073741824);
		expect(result).toBe('1 GB');
	});
	test('4', () => {
		const result = filesize.default(6356551598);
		expect(result).toBe('5.92 GB');
	});
});
