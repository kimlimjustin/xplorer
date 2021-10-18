import { invoke } from '@tauri-apps/api/tauri';
document.addEventListener('DOMContentLoaded', () => {
	document.querySelector('.path-navigator').addEventListener('change', () => {
		invoke('read_directory', {
			dir: (document.querySelector('.path-navigator') as HTMLInputElement)
				.value,
		}).then((msg) => console.log(msg));
	});
});
