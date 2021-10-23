const { extractIcon } = require('./bindings');
const fs = require('fs');

test('Extract exe icon', () => {
	if (process.platform === 'win32') {
		const buffer = extractIcon('C:\\Windows\\System32\\cmd.exe', 'large');
		fs.writeFileSync('test.ico', buffer);
		fs.unlinkSync('test.ico');
	}
});
