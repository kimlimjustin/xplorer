import Translate from '../I18n/i18n';
import { updateTheme } from '../Theme/theme';
import fileIcon from '../Files/File Icon/fileIcon';

import About from './About/about';
import Appearance from './Appearance/Appearance';
import Preference from './Preference/preference';

/**
 * Setting initializer function
 * @returns {void}
 */
const Setting = (): void => {
	const settingsItem = ['Appearance', 'Preference', 'About'];
	const defaultTab = settingsItem[0];

	const setActiveTab = (tab: string) => {
		settingsItem.forEach((tabs: string) => {
			if (tabs === tab) {
				document
					.getElementById(tabs.toLowerCase())
					.parentElement.classList.add('active');
			} else
				document
					.getElementById(tabs.toLowerCase())
					.parentElement.classList.remove('active');
		});
		updateTheme();
		Array.from(
			document.getElementsByClassName(
				'settings-sidebar-item'
			) as HTMLCollectionOf<HTMLElement>
		).forEach((element) => {
			console.log(element.classList.contains('active'));
			if (!element.classList.contains('active'))
				element.style.background = '';
		});
	};

	document
		.querySelector('.sidebar-setting-btn')
		.addEventListener('click', () => {
			document.querySelector<HTMLElement>('.settings').style.animation =
				'open-setting 1s forwards';
			document.querySelector('.settings-sidebar-heading').innerHTML =
				Translate('Settings');
			const settingsSidebarItems = document.querySelector(
				'.settings-sidebar-items'
			);
			settingsSidebarItems.innerHTML = '';

			settingsItem.map((item) => {
				console.log(Translate(item));
				const settingsItem = document.createElement('span');
				settingsItem.classList.add(
					'settings-sidebar-item',
					'sidebar-hover-effect'
				);
				settingsItem.innerHTML = `<img src="${fileIcon(
					item,
					'settings',
					false
				)}"><span id=${item.toLowerCase()}>${Translate(item)}</span>`;
				settingsSidebarItems.appendChild(settingsItem);

				settingsItem.addEventListener('click', () => {
					setActiveTab(item);
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

			setActiveTab(defaultTab);
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
