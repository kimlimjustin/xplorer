import { invoke } from '@tauri-apps/api/tauri';
import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
document.addEventListener('DOMContentLoaded', () => {
	windowManager();
	updateTheme();
	document.querySelector('.path-navigator').addEventListener('change', () => {
		invoke('read_directory', {
			dir: (document.querySelector('.path-navigator') as HTMLInputElement)
				.value,
		}).then((msg) => console.log(msg));
	});
});
