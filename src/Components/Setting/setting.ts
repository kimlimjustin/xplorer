import Translate from '../I18n/i18n';
import fileThumbnail from '../Thumbnail/thumbnail';
import Storage from '../../Service/storage';

import About from './About/about';
import Appearance from './Appearance/Appearance';
import Preference from './Preference/preference';

/**
 * Setting initializer function
 * @returns {Promise<void>}
 */
const Setting = async (): Promise<void> => {
	const settingsItem = ['Appearance', 'Preference', 'About'];
	const defaultTab = settingsItem[0];

	const setActiveTab = (tab: string) => {
		settingsItem.forEach((tabs: string) => {
			if (tabs === tab) {
				document.getElementById(tab.toLowerCase()).parentElement.classList.add('active');
			} else document.getElementById(tabs.toLowerCase()).parentElement.classList.remove('active');
		});
		Array.from(document.getElementsByClassName('settings-sidebar-item') as HTMLCollectionOf<HTMLElement>).forEach((element) => {
			if (!element.classList.contains('active')) element.style.background = '';
		});
	};

	document.querySelector('#sidebar-setting-btn').addEventListener('click', async () => {
		document.querySelector<HTMLElement>('.settings').style.animation = 'open-setting 1s forwards';
		document.querySelector('.settings-sidebar-heading').innerHTML = await Translate('Settings');
		const settingsSidebarItems = document.querySelector('.settings-sidebar-items');
		settingsSidebarItems.innerHTML = '';

		for (const item of settingsItem) {
			const settingsItem = document.createElement('span');
			settingsItem.classList.add('settings-sidebar-item', 'sidebar-hover-effect');
			settingsItem.innerHTML = `<img src="${await fileThumbnail(item, 'settings', false)}"><span id=${item.toLowerCase()}>${await Translate(
				item
			)}</span>`;
			settingsSidebarItems.appendChild(settingsItem);

			settingsItem.addEventListener('click', async () => {
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
				const appearance = (await Storage.get('appearance')) ?? {};
				appearance['activeSettingsTab'] = item;
				Storage.set('appearance', appearance);
			});
		}
		const appearance = (await Storage.get('appearance')) ?? {};
		const activeSettingsTab = appearance['activeSettingsTab'] ?? defaultTab;
		setActiveTab(activeSettingsTab);
		switch (activeSettingsTab) {
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

		document.querySelector('.exit-setting-btn').addEventListener('click', () => {
			document.querySelector<HTMLElement>('.settings').style.animation = 'close-setting 1s forwards';
		});
	});
};

export default Setting;
