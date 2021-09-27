import Translate from '../I18n/i18n';
import fileIcon from '../Files/File Icon/fileIcon';
import { updateTheme } from '../Theme/theme';
import Appearance from './Appearance/Appearance';
import About from './About/about';
import Preference from './Preference/preference';

/**
 * Setting initializer function
 * @returns {void}
 */
const Setting = (): void => {
	document
		.querySelector('.sidebar-setting-btn')
		.addEventListener('click', () => {
			document.querySelector<HTMLElement>('.settings').style.animation =
				'open-setting 1s forwards';

			document.querySelector('.settings-sidebar-heading').innerHTML =
				Translate(
					document.querySelector('.settings-sidebar-heading')
						.innerHTML
				);
			const settingsSidebarItems = document.querySelector(
				'.settings-sidebar-items'
			);
			settingsSidebarItems.innerHTML = '';
			const settingsItem = ['Appearance', 'Preference', 'About'];

			settingsItem.map((item) => {
				const settingsItem = document.createElement('span');
				settingsItem.classList.add('settings-sidebar-item');
				settingsItem.classList.add('sidebar-hover-effect');
				settingsItem.innerHTML = `<img src="${fileIcon(
					item,
					'settings',
					false
				)}"><span>${item}</span>`;
				settingsSidebarItems.appendChild(settingsItem);

				settingsItem.addEventListener('click', () => {
					switch (item) {
						case 'Appearance':
							Appearance();
							break;
						case 'Preference':
							Preference();
							break;
						case 'About':
							About();
							break;
					}
				});
			});
			updateTheme();
			Appearance();

			document
				.querySelector('.exit-setting-btn')
				.addEventListener('click', () => {
					document.querySelector<HTMLElement>(
						'.settings'
					).style.animation = 'close-setting 1s forwards';
				});
		});
};

export default Setting;
