const fs = require('fs');
const path = require('path');
const Copy =
	require('../outs/src/Components/Files/File Operation/copy').default;
const spawn = require('cross-spawn');

beforeAll(() => {
	try {
		fs.mkdirSync('temp');
	} catch (_) {}
	fs.writeFileSync(path.join(__dirname, '../temp/a'), 'abc');
});

afterAll(() => {
	spawn('yarn', ['run', 'rimraf', 'temp']);
});

test('Copy file operation', () => {
	if (process.platform !== 'linux') {
		Copy([path.join(__dirname, '../temp/a')]);
		const clipboardEx = require('electron-clipboard-ex');
		expect(clipboardEx.readFilePaths()).toEqual([
			path.join(__dirname, '../temp/a'),
		]);
	}
});
