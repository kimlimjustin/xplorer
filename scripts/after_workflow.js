// Check if the workflow is run on GitHub Actions
if (process.env.GITHUB_ACTIONS === 'true') {
	const fs = require('fs');
	const path = require('path');
	const tauriConf = require('../src-tauri/tauri.conf.json');
	const spawn = require('cross-spawn');

	tauriConf.tauri.bundle.windows.wix = {
		template: './installer.wxs',
		license: '../LICENSE',
	};
	fs.writeFileSync(path.join(__dirname, '../src-tauri/tauri.conf.json'), JSON.stringify(tauriConf, null, 2));
	spawn('tauri', ['build']);
}
