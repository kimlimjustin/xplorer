import { version, description } from '../../../../package.json';
import path from 'path';
import ejs from 'ejs';
import os from 'os';
/**
 * Create about section
 * @returns {any}
 */
const About = (): void => {
	const settingsMain = document.querySelector('.settings-main');
	ejs.renderFile(path.join(__dirname, 'about.ejs'), {
		version,
		description,
		versions: process.versions,
		os: os.release(),
		copyToClipboard: (str: string) => {
			return `navigator.clipboard.writeText('${str}')`;
		},
	}).then((result) => {
		settingsMain.innerHTML = result;
	});
};
export default About;
