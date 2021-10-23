import * as validChecker from './validChecker';
// @ponicode
describe('validChecker.default', () => {
	test('0', () => {
		const result = validChecker.default({
			key1: 'Foo bar',
			key5: -5.48,
		});
		expect(result).toBe(true);
	});

	test('1', () => {
		const result = validChecker.default({ key1: 'foo bar', key5: -100 });
		expect(result).toBe(true);
	});

	test('2', () => {
		const result = validChecker.default({
			key1: 'Hello, world!',
			key5: 1,
		});
		expect(result).toBe(true);
	});

	test('3', () => {
		const result = validChecker.default({
			key1: 'Hello, world!',
			key5: -100,
		});
		expect(result).toBe(true);
	});

	test('4', () => {
		const result = validChecker.default(undefined);
		expect(result).toBe(false);
	});
	test('5', () => {
		const result = validChecker.default(null);
		expect(result).toBe(false);
	});
	test('5', () => {
		const result = validChecker.default({});
		expect(result).toBe(false);
	});
	test('6', () => {
		const result = validChecker.default([]);
		expect(result).toBe(false);
	});
});
