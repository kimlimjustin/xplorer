const spawn = require('cross-spawn');
const fs = require('fs');

if (fs.existsSync('temp/postinstalled')) {
	spawn('yarn', ['run', 'rimraf', 'temp']);
	return;
} else {
	if (!fs.existsSync('temp')) {
		fs.mkdirSync('temp');
	}
	fs.writeFileSync('temp/postinstalled', '');
	spawn.sync('npm', ['run', 'patch-package'], {
		input: 'Installing dependencies once again to patch packages',
		stdio: 'inherit',
	});
}
