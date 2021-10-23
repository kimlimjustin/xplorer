import storage from 'electron-json-storage-sync';
import { isHiddenFile } from 'is-hidden-file';
import { isElementInViewport } from '../../Functions/lazyLoadingImage';
import { elementClassNameContains } from '../../Functions/elementClassNameContains';

let latestSelected: HTMLElement;
let latestShiftSelected: HTMLElement;
let initialized = false;
/**
 * Select a file grid...
 *
 * Unselect all selected files and select the clicked file if user's not pressing ctrl nor shift key...
 *
 * If user pressing ctrl key, select the clicked file without unselect selected files...
 *
 * If user pressing shift key, select all the range from the clicked file to the latest clicked file
 * @param {HTMLElement} element - element you want to selefct
 * @param {boolean} ctrl - does user pressing ctrl while clicking the file grid
 * @param {boolean} shift - does user pressing shift while clicking the file grid
 * @param {NodeListOf<Element>} elements - array of elements that being listened
 * @returns {void}
 */
const Select = (
	element: HTMLElement,
	ctrl: boolean,
	shift: boolean,
	elements: NodeListOf<Element>
): void => {
	if (!ctrl && !shift) unselectAllSelected();
	// add 'selected' class if element classlist does not contain it...
	if (!element.classList.contains('selected'))
		element.classList.add('selected');
	// ...Otherwise, remove it
	else element.classList.remove('selected');
	if (shift && latestSelected) {
		let start = false;
		for (const _element of elements) {
			if (start) _element.classList.add('selected');
			else _element.classList.remove('selected');
			if (_element === latestSelected) {
				start = !start;
				_element.classList.add('selected');
			} else if (_element === element) {
				start = !start;
				_element.classList.add('selected');
			}
		}
	} else {
		const { getSelectedStatus } = require('../../Shortcut/shortcut'); //eslint-disable-line
		if (getSelectedStatus() && ctrl) return;
		latestSelected = element;
		latestShiftSelected = element;
	}
};

/**
 * Ensure an element in view port
 * @param {HTMLElement} element - element you want to ensure
 * @returns {void}
 */
const ensureElementInViewPort = (element: HTMLElement): void => {
	if (!isElementInViewport(element)) element.scrollIntoView();
};

/**
 * Select the first file there in case the latest selected file is not exist
 * @returns {any}
 */
const selectFirstFile = () => {
	const firstFileElement = document
		.getElementById('workspace')
		.querySelector(
			`.file${isHiddenFile ? ':not([data-hidden-file])' : ''}`
		);
	firstFileElement.classList.add('selected');
	latestSelected = firstFileElement as HTMLElement;
};

const elementIndex = (element: HTMLElement): number => {
	return Array.from(element.parentNode.children).indexOf(element);
};

/**
 * Select shortcut initializer
 * @returns {any}
 */
const Initializer = () => {
	const selectShortcut = (e: KeyboardEvent) => {
		// Ignore keyboard shortcuts for select files if path navigator has focus
		if (
			document.querySelector('.path-navigator') === document.activeElement
		)
			return;

		const hideHiddenFiles =
			storage.get('preference')?.data?.hideHiddenFiles ?? true;

		const keyHandlers: { [key: string]: (e: KeyboardEvent, hideHiddenFiles: boolean) => void } = {
			ArrowRight: arrowRightHandler,
			ArrowLeft: arrowLeftHandler,
			ArrowDown: arrowDownHandler,
			ArrowUp: arrowUpHandler,
		}

		if (!e.altKey && keyHandlers[e.key]) {
			if (!document.contains(latestSelected)) {
				selectFirstFile();
				return;
			}

			keyHandlers[e.key](e, hideHiddenFiles);
		}
	};
	document.addEventListener('keydown', selectShortcut);
};

/**
 * Select files listener
 * @param {NodeListOf<Element>} elements
 * @returns {void}
 */
const SelectListener = (elements: NodeListOf<Element>): void => {
	elements.forEach((element: HTMLElement) => {
		element.addEventListener('click', (e) => {
			Select(element, e.ctrlKey, e.shiftKey, elements);
		});
	});
	document.getElementById('workspace').addEventListener('click', (e) => {
		if (
			!(e.target as HTMLElement).className.split(' ').some(function (c) {
				return /file/.test(c);
			})
		) {
			unselectAllSelected();
			latestSelected = null;
			latestShiftSelected = null;
		}
	});

	if (!initialized) {
		Initializer();
		initialized = true;
	}
};
/**
 * Unselect all selected file grids.
 * @returns {void}
 */
const unselectAllSelected = (): void => {
	document
		.querySelectorAll('.selected')
		.forEach((element) => element.classList.remove('selected'));
	return;
};

/**
 * Get selected files array
 * @returns {NodeListOf<HTMLElement>}
 */
const getSelected = (): NodeListOf<HTMLElement> => {
	return document.querySelectorAll<HTMLElement>('.selected');
};

const arrowRightHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (elementIndex(latestShiftSelected) < elementIndex(latestSelected)) {
		latestShiftSelected = latestSelected;
	}
	e.preventDefault();
	let nextSibling = (
		e.shiftKey
			? latestShiftSelected.nextSibling
			: latestSelected.nextSibling
	) as HTMLElement;
	if (hideHiddenFiles) {
		while (
			nextSibling &&
			nextSibling.dataset.hiddenFile !== undefined
			) {
			nextSibling = nextSibling.nextSibling as HTMLElement;
		}
	}
	if (elementClassNameContains(nextSibling, /file/)) {
		ensureElementInViewPort(nextSibling);
		unselectAllSelected();
		if (e.shiftKey) {
			let start = false;
			for (const sibling of latestSelected.parentNode.children) {
				if (
					start ||
					sibling === nextSibling ||
					sibling === latestSelected
				) {
					if (
						!(
							hideHiddenFiles &&
							(sibling as HTMLElement).dataset
								.hiddenFile === 'true'
						)
					)
						sibling.classList.add('selected');
				}
				if (sibling === latestSelected) start = true;
				if (sibling === nextSibling) break;
			}
			latestShiftSelected = nextSibling;
		} else {
			latestSelected.classList.remove('selected');
			latestSelected = nextSibling;
			nextSibling.classList.add('selected');
		}
	}
}

const arrowLeftHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (elementIndex(latestShiftSelected) > elementIndex(latestSelected))
		latestShiftSelected = latestSelected;

	e.preventDefault();
	let previousSibling = (
		e.shiftKey
			? latestShiftSelected.previousSibling
			: latestSelected.previousSibling
	) as HTMLElement;
	if (hideHiddenFiles) {
		while (
			previousSibling &&
			previousSibling.dataset.hiddenFile !== undefined
			) {
			previousSibling =
				previousSibling.previousSibling as HTMLElement;
		}
	}
	if (elementClassNameContains(previousSibling, /file/)) {
		ensureElementInViewPort(previousSibling);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (
					start ||
					sibling === previousSibling ||
					sibling === latestSelected
				) {
					if (
						!(
							hideHiddenFiles &&
							(sibling as HTMLElement).dataset
								.hiddenFile === 'true'
						)
					)
						sibling.classList.add('selected');
				}
				if (sibling === previousSibling) start = true;
				if (sibling === latestSelected) break;
			}
			latestShiftSelected = previousSibling;
		} else {
			latestSelected.classList.remove('selected');
			latestSelected = previousSibling;
			previousSibling.classList.add('selected');
		}
	}
}

const arrowDownHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (elementIndex(latestShiftSelected) < elementIndex(latestSelected))
		latestShiftSelected = latestSelected;

	e.preventDefault();
	const totalGridInArrow = Math.floor(
		(latestSelected.parentNode as HTMLElement).offsetWidth /
		(latestSelected.offsetWidth +
			parseInt(getComputedStyle(latestSelected).marginLeft) *
			2)
	); // Calculate the total of grids in arrow
	const siblings = latestSelected.parentNode.children;
	let elementBelow = siblings[
		Array.from(siblings).indexOf(
			e.shiftKey
				? latestShiftSelected
				: latestSelected
		) + totalGridInArrow
	] as HTMLElement;
	if (hideHiddenFiles) {
		while (
			elementBelow &&
			elementBelow.dataset.hiddenFile !== undefined
			) {
			elementBelow = siblings[
			Array.from(siblings).indexOf(elementBelow) +
			totalGridInArrow
				] as HTMLElement;
		}
	}
	if (elementClassNameContains(elementBelow, /file/)) {
		ensureElementInViewPort(elementBelow);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (
					start ||
					sibling === elementBelow ||
					sibling === latestSelected
				) {
					if (
						!(
							hideHiddenFiles &&
							(sibling as HTMLElement).dataset
								.hiddenFile === 'true'
						)
					)
						sibling.classList.add('selected');
				}
				if (sibling === latestSelected) start = true;
				if (sibling === elementBelow) break;
			}
			latestShiftSelected = elementBelow;
		} else {
			latestSelected.classList.remove('selected');
			latestSelected = elementBelow;
			elementBelow.classList.add('selected');
		}
	}
}

const arrowUpHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (elementIndex(latestShiftSelected) > elementIndex(latestSelected))
		latestShiftSelected = latestSelected;

	e.preventDefault();
	const totalGridInArrow = Math.floor(
		(latestSelected.parentNode as HTMLElement).offsetWidth /
		(latestSelected.offsetWidth +
			parseInt(getComputedStyle(latestSelected).marginLeft) *
			2)
	); // Calculate the total of grids in arrow
	const siblings = latestSelected.parentNode.children;
	let elementAbove = siblings[
		Array.from(siblings).indexOf(
			e.shiftKey
				? latestShiftSelected
				: latestSelected
		) - totalGridInArrow
	] as HTMLElement;
	if (hideHiddenFiles) {
		while (elementAbove && elementAbove.dataset.hiddenFile !== undefined) {
			elementAbove = siblings[
				Array.from(siblings).indexOf(elementAbove) - totalGridInArrow
			] as HTMLElement;
		}
	}
	if (elementClassNameContains(elementAbove, /file/)) {
		ensureElementInViewPort(elementAbove);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (
					start ||
					sibling === elementAbove ||
					sibling === latestSelected
				) {
					if (
						!(
							hideHiddenFiles &&
							(sibling as HTMLElement).dataset
								.hiddenFile === 'true'
						)
					)
						sibling.classList.add('selected');
				}
				if (sibling === elementAbove) start = true;
				if (sibling === latestSelected) break;
			}
			latestShiftSelected = elementAbove;
		} else {
			latestSelected.classList.remove('selected');
			latestSelected = elementAbove;
			elementAbove.classList.add('selected');
		}
	}
}

export { Select, SelectListener, getSelected };
