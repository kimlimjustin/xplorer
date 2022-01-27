import Storage from '../../Service/storage';
let infoBarElement: HTMLElement;

const UpdateInfo = (key: string, value: string): void => {
	const el = document.querySelector(`.infobar-item#${key}`);
	if (!el) return;
	el.innerHTML = value;
};

/**
 * Initialize and create infobar element
 * @returns {any}
 */
const Infobar = async (): Promise<void> => {
	const appearance = await Storage.get('appearance');
	document.body.dataset.infobarEnabled = appearance?.showInfoBar ?? true;
	if (!(appearance?.showInfoBar ?? true)) return;
	infoBarElement = document.createElement('div');
	infoBarElement.classList.add('infobar');
	infoBarElement.id = 'infobar';
	infoBarElement.innerHTML = `
	<div class="infobar-item" id="number-of-files"></div>
	<div class="infobar-item" id="selected-files"></div>
	`;
	document.querySelector('.main').appendChild(infoBarElement);
};
export default Infobar;
export { UpdateInfo };
