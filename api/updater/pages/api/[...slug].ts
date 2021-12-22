import { AVAILABLE_PLATFORMS, validatePlatform } from '../../util/platform';
import semver from 'semver';
import { GITHUB_TOKEN } from '../../util/constant';

export default async function handler(req: any, res: any) {
	const { slug } = req.query;
	const platform = slug[0];
	const version = slug[1];

	if (!platform || !validatePlatform(platform)) {
		res.status(400).send('Invalid platform');
		return;
	}

	if (!version || !semver.valid(version)) {
		res.status(400).send('Invalid version');
		return;
	}
	const reqUrl = new URL(`https://api.github.com/repos/kimlimjustin/xplorer/releases`);
	// Headers
	const headers: HeadersInit = { Accept: 'application/vnd.github.preview' };
	if (GITHUB_TOKEN && GITHUB_TOKEN.length > 0) {
		headers.Authorization = `token ${GITHUB_TOKEN}`;
	}
	const release = await (await fetch(reqUrl.toString(), { method: 'GET', headers })).json();

	// Get the latest release but only the ones that is not draft
	let index = 0;
	let latest_release = release[index];
	while (latest_release.draft) {
		index++;
		latest_release = release[index];
	}
	const latest_version = sanitizeVersion(latest_release.tag_name);
	const should_update = semver.gt(latest_version, version);
	if (!should_update) {
		res.status(204).send('');
		return;
	}
	for (const asset of latest_release.assets) {
		const { name, browser_download_url } = asset;
		const findPlatform = checkPlatform(platform, name);
		if (!findPlatform) continue;

		res.status(200).json({
			name: latest_release.tag_name,
			notes: `Please visit ${latest_release.html_url} to see the detailed changelog.`,
			pub_date: latest_release.published_at,
			signature: '',
			url: browser_download_url,
		});
		return;
	}
	res.status(204).send('');
}

function sanitizeVersion(version: string): string {
	// if it start with v1.0.0 remove the `v`
	if (version.charAt(0) === 'v') {
		return version.substring(1);
	}

	return version;
}

function extname(filename: string) {
	return filename.split('.').pop() || '';
}

function checkPlatform(platform: string, fileName: string) {
	const extension = extname(fileName);

	// OSX we should have our .app tar.gz
	if (
		(fileName.includes('.app') || fileName.includes('darwin') || fileName.includes('osx')) &&
		extension === 'gz' &&
		platform === AVAILABLE_PLATFORMS.MacOS
	) {
		return 'darwin';
	}

	// Windows 64 bits
	if ((fileName.includes('x64') || fileName.includes('win64')) && extension === 'zip' && platform === AVAILABLE_PLATFORMS.Win64) {
		return 'win64';
	}

	// Windows 32 bits
	if ((fileName.includes('x32') || fileName.includes('win32')) && extension === 'zip' && platform === AVAILABLE_PLATFORMS.Win32) {
		return 'win32';
	}

	// Linux app image
	if (fileName.includes('AppImage') && extension === 'gz' && platform === AVAILABLE_PLATFORMS.Linux) {
		return 'linux';
	}
}
