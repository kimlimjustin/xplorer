import { elementClassNameContains } from '../../Functions/elementClassNameContains';
import Storage from '../../../Service/storage';
import { UpdateInfo } from '../../Layout/infobar';
import FileAPI from '../../../Service/files';
import formatBytes from '../../Functions/filesize';
import Preview from '../File Preview/preview';
import { ensureElementInViewPort } from '../../Functions/viewport';
import { MAIN_BOX_ELEMENT } from '../../../Util/constants';
import { direction } from '../../../Typings/select';

let latestSelected: HTMLElement;
let latestShiftSelected: HTMLElement;

//Mouse drag selection vars
class Point {
	private _x: number;
    private _y: number;

    constructor(x = 0, y = 0) {
        this._x = x;
        this._y = y;
    }

    public get x(): number { return this._x; }
    public get y(): number { return this._y; }

    public set x(newX: number) { this._x = newX; }
    public set y(newY: number) { this._y = newY; }

    public Set(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

	public delta(target: Point) {
		return new Point(this.x - target.x, this.y - target.y);
	}
}
let selectingDiv: HTMLElement = document.createElement('div');
selectingDiv.setAttribute('style', 'position: absolute; background-color: rgba(100, 100, 255, 0.2); z-index: 100;');
let isSelecting: boolean = false;
let selectingOrigin: Point;
let mainBoxBounds: DOMRect;
let selected = 0;
const selectingDivBounds = { left: 0, top: 0, right: 0, bottom: 0, height: 0, width: 0 };

/**
 * Call this function whenever user selected (a) file grid(s).
 * @returns {Promise<void>}
 */
const ChangeSelectedEvent = async (): Promise<void> => {
	const selectedFileGrid = document.querySelectorAll('.file-grid.selected');
	if (!selectedFileGrid.length) UpdateInfo('selected-files', '');
	else {
		const selectedFilePaths = Array.from(selectedFileGrid).map((element) => decodeURI((element as HTMLElement).dataset.path));
		const total_sizes = await new FileAPI(selectedFilePaths).calculateFilesSize();
		UpdateInfo('selected-files', `${selectedFileGrid.length} file${selectedFileGrid.length > 1 ? 's' : ''} selected ${formatBytes(total_sizes)}`);
		if (
			selectedFilePaths.length === 1 &&
			document.querySelectorAll('.preview').length > 0 &&
			((await Storage.get('preference'))?.automaticallyChangePreviewFile ?? true)
		) {
			Preview(selectedFilePaths[0]);
		}
	}
};
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
 * @returns {void}
 */
const Select = (element: HTMLElement, ctrl: boolean, shift: boolean): void => {
	if (!ctrl && !shift) unselectAllSelected();
	// add 'selected' class if element classlist does not contain it...
	if (!element.classList.contains('selected')) element.classList.add('selected');
	// ...Otherwise, remove it
	else element.classList.remove('selected');
	if (shift && latestSelected) {
		let start = false;
		for (const _element of document.querySelectorAll('.file')) {
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
		const { getSelectedAllStatus } = require('../../Shortcut/shortcut'); //eslint-disable-line
		if (getSelectedAllStatus() && ctrl) return;
		latestSelected = element;
		latestShiftSelected = element;
	}
	ChangeSelectedEvent();
	ensureElementInViewPort(element);
};

/**
 * Select the first file there in case the latest selected file is not exist
 * @returns {Promise<void>}
 */
const selectFirstFile = async (): Promise<void> => {
	const hideHiddenFiles = (await Storage.get('preference'))?.hideHiddenFiles ?? true;
	const firstFileElement = MAIN_BOX_ELEMENT().querySelector(`.file${hideHiddenFiles ? ':not([data-hidden-file])' : ''}`);
	firstFileElement.classList.add('selected');
	ChangeSelectedEvent();
	latestSelected = firstFileElement as HTMLElement;
};

const elementIndex = (element: HTMLElement): number => {
	return Array.from(element.parentNode.children).indexOf(element);
};

/**
 * Initialize select files function
 * @returns {void}
 */
const SelectInit = (): void => {
	//Saving the main box element in a variable, better than calling MAIN_BOX_ELEMENT() everytime
	const MAIN_BOX_EL: HTMLElement = MAIN_BOX_ELEMENT();
	mainBoxBounds = MAIN_BOX_EL.getBoundingClientRect();

	MAIN_BOX_EL.addEventListener('click', (e) => {
		if (
			!(e.target as HTMLElement).className.split(' ').some(function (c) {
				return /file/.test(c);
			}) &&
			//If user doesn't drag the mouse
			(e.pageX - mainBoxBounds.left == selectingOrigin.x &&
				e.pageY - mainBoxBounds.top == selectingOrigin.y)
		) {
			unselectAllSelected();
			latestSelected = null;
			latestShiftSelected = null;
		}
		let fileTarget = e.target as HTMLElement;
		while (fileTarget?.classList && !fileTarget.classList.contains('file')) fileTarget = fileTarget.parentNode as HTMLElement;
		if (fileTarget.id === 'workspace' || !fileTarget?.classList?.contains('file')) return;

		Select(fileTarget, e.ctrlKey, e.shiftKey);
	});

	MAIN_BOX_EL.addEventListener('mousedown', (e) => {
		/// SelectInit is called async, therefore bounds come before full element calculation.
		/// Here is to avoid wrong div placement, but we can find a better way without calling getBoundingClientRect each mousedown
		mainBoxBounds = MAIN_BOX_EL.getBoundingClientRect();
		//Start selection
		isSelecting = true;
		//Save selection starting point
		selectingOrigin = new Point(e.pageX - mainBoxBounds.left, e.pageY - mainBoxBounds.top);
		if (
			!(e.target as HTMLElement).className.split(' ').some(function (c) {
				return /file/.test(c);
			})
		) {
			MAIN_BOX_EL.prepend(selectingDiv);
			selectingDiv.style.inset = selectingOrigin.y + 'px auto ' + selectingOrigin.x + 'px auto';
			selectingDiv.style.width = selectingDiv.style.height = 'auto';
		}
	});

	//Check when mouse is released. On window to catch events outside of main box
	window.addEventListener('mouseup', (e) => {
		if(isSelecting) {
			isSelecting = false;

			selectingDiv.style.inset = selectingDiv.style.width = selectingDiv.style.height = 'auto';

			selectingDiv.remove();
		}
	});

	//Calculates selection div size and position + which files are selected
	MAIN_BOX_EL.addEventListener('mousemove', async(e) => {
		const POSITION = new Point(e.pageX - mainBoxBounds.left, e.pageY - mainBoxBounds.top);
		if(isSelecting) {
			const DIRECTION = await getSelectingDivDirection(selectingOrigin, POSITION);
			let top, right, bottom, left,
				height = Math.abs(selectingOrigin.y - POSITION.y),
				width = Math.abs(selectingOrigin.x - POSITION.x);
			
			switch(DIRECTION.y) {
				case 0:
					top = selectingOrigin.y;
					bottom = mainBoxBounds.height - selectingOrigin.y;
					break;
				case -1:
					bottom = mainBoxBounds.height - selectingOrigin.y;
					top = 'auto';
					break;
				case 1:
					bottom = 'auto';
					top = selectingOrigin.y;
					break;
			}
			
			switch(DIRECTION.x) {
				case 0:
					left = selectingOrigin.x;
					right = mainBoxBounds.width - selectingOrigin.x;
					break;
				case -1:
					left = 'auto';
					right = mainBoxBounds.width - selectingOrigin.x;
					break;
				case 1:
					left = selectingOrigin.x;
					right = 'auto';
					break;
			}

			//Updating selecting div bounds manually so we don't call getBoundingClientRect each mousemove
			selectingDivBounds.bottom = bottom == 'auto' ? mainBoxBounds.height - (top as number) - height : bottom as number;
			selectingDivBounds.top = top == 'auto' ? mainBoxBounds.height - (bottom as number) - height : top as number;
			selectingDivBounds.left = left == 'auto' ? mainBoxBounds.width - (right as number) - width : left as number;
			selectingDivBounds.right = right == 'auto' ? mainBoxBounds.width - (left as number) - width : right as number;
			selectingDivBounds.width = width;
			selectingDivBounds.height = height;

			selectingDiv.style.inset = top + (top == 'auto' ? ' ' : 'px ') + right + (right == 'auto' ? ' ' : 'px ')  + 
				bottom + (bottom == 'auto' ? ' ' : 'px ')  + left + (left == 'auto' ? ' ' : 'px ');
			selectingDiv.style.height = height + 'px';
			selectingDiv.style.width = width + 'px';

			const FILES = MAIN_BOX_EL.getElementsByClassName('file');
			
			for(let x = 0; x < FILES.length; x++) {
				const CURRENT = FILES[x] as HTMLElement;
				//This should be fine since this function is async
				const BOUNDS = CURRENT.getBoundingClientRect();

				//If overlaps
				if(!(BOUNDS.right - mainBoxBounds.left < selectingDivBounds.left ||
					BOUNDS.left - mainBoxBounds.left > mainBoxBounds.width - selectingDivBounds.right ||
					BOUNDS.bottom - mainBoxBounds.top < selectingDivBounds.top ||
					BOUNDS.top - mainBoxBounds.top > mainBoxBounds.height - selectingDivBounds.bottom) &&
					isSelecting) 
				{
					if(!CURRENT.classList.contains('selected')) CURRENT.classList.add('selected');
					selected++;
				} else {
					if(CURRENT.classList.contains('selected')) {
						CURRENT.classList.remove('selected');
						selected--;
					}
				}
			}
			if(selected == 0) unselectAllSelected();
		}
	});

	//Updates main box bounds on resize
	MAIN_BOX_EL.addEventListener('resize', (e) => {
		mainBoxBounds = MAIN_BOX_EL.getBoundingClientRect();
	});

	const selectShortcut = async (e: KeyboardEvent) => {
		// Ignore keyboard shortcuts for select files if input element has focus.
		if (document.activeElement.tagName === 'INPUT') return;

		const hideHiddenFiles = (await Storage.get('preference'))?.hideHiddenFiles ?? true;

		const keyHandlers: {
			[key: string]: (e: KeyboardEvent, hideHiddenFiles: boolean) => void;
		} = {
			ArrowRight: arrowRightHandler,
			ArrowLeft: arrowLeftHandler,
			ArrowDown: arrowDownHandler,
			ArrowUp: arrowUpHandler,
		};

		if (!e.altKey && keyHandlers[e.key]) {
			if (!document.contains(latestSelected)) {
				await selectFirstFile();
				return;
			}

			keyHandlers[e.key](e, hideHiddenFiles);
		}
	};
	document.addEventListener('keydown', selectShortcut);
};

/**
 * 
 * @param origin - mouse drag selection origin point
 * @param last - last mouse position
 * @returns {Promise<direction>} - direction based on coord deltas, x and y can be either -1, 0 or 1 indicating the direction relative to point 0,0
 */
const getSelectingDivDirection = async(origin: Point, last: Point): Promise<direction> => {
	const delta = origin.delta(last);

	return { x: delta.x == 0 ? 0 : delta.x > 0 ? -1 : 1,
			y: delta.y == 0 ? 0 : delta.y > 0 ? -1 : 1 };
}
/**
 * Unselect all selected file grids.
 * @returns {void}
 */
const unselectAllSelected = (): void => {
	document.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
	ChangeSelectedEvent();
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
	if (latestShiftSelected && elementIndex(latestShiftSelected) < elementIndex(latestSelected)) {
		latestShiftSelected = latestSelected;
	}
	e.preventDefault();
	let nextSibling = (e.shiftKey ? latestShiftSelected.nextSibling : latestSelected.nextSibling) as HTMLElement;
	if (hideHiddenFiles) {
		while (nextSibling && nextSibling.dataset.isHidden === 'true') {
			nextSibling = nextSibling.nextSibling as HTMLElement;
		}
	}
	if (elementClassNameContains(nextSibling, /file/)) {
		ensureElementInViewPort(nextSibling);
		unselectAllSelected();
		if (e.shiftKey) {
			let start = false;
			for (const sibling of latestSelected.parentNode.children) {
				if (start || sibling === nextSibling || sibling === latestSelected) {
					if (!(hideHiddenFiles && (sibling as HTMLElement).dataset.isHidden === 'true')) sibling.classList.add('selected');
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
		ChangeSelectedEvent();
	}
};

const arrowLeftHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (latestShiftSelected && elementIndex(latestShiftSelected) > elementIndex(latestSelected)) latestShiftSelected = latestSelected;

	e.preventDefault();
	let previousSibling = (e.shiftKey ? latestShiftSelected.previousSibling : latestSelected.previousSibling) as HTMLElement;
	if (hideHiddenFiles) {
		while (previousSibling && previousSibling.dataset.isHidden === 'true') {
			previousSibling = previousSibling.previousSibling as HTMLElement;
		}
	}
	if (elementClassNameContains(previousSibling, /file/)) {
		ensureElementInViewPort(previousSibling);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (start || sibling === previousSibling || sibling === latestSelected) {
					if (!(hideHiddenFiles && (sibling as HTMLElement).dataset.isHidden === 'true')) sibling.classList.add('selected');
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
		ChangeSelectedEvent();
	}
};

const arrowDownHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (latestShiftSelected && elementIndex(latestShiftSelected) < elementIndex(latestSelected)) latestShiftSelected = latestSelected;

	e.preventDefault();
	const totalGridInArrow = Math.floor(
		(latestSelected.parentNode as HTMLElement).offsetWidth /
			(latestSelected.offsetWidth + parseInt(getComputedStyle(latestSelected).marginLeft) * 2)
	); // Calculate the total of grids in arrow
	const siblings = latestSelected.parentNode.children;
	let elementBelow = siblings[Array.from(siblings).indexOf(e.shiftKey ? latestShiftSelected : latestSelected) + totalGridInArrow] as HTMLElement;
	if (hideHiddenFiles) {
		while (elementBelow && elementBelow.dataset.isHidden === 'true') {
			elementBelow = siblings[Array.from(siblings).indexOf(elementBelow) + totalGridInArrow] as HTMLElement;
		}
	}
	if (elementClassNameContains(elementBelow, /file/)) {
		ensureElementInViewPort(elementBelow);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (start || sibling === elementBelow || sibling === latestSelected) {
					if (!(hideHiddenFiles && (sibling as HTMLElement).dataset.isHidden === 'true')) sibling.classList.add('selected');
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
		ChangeSelectedEvent();
	}
};

const arrowUpHandler = (e: KeyboardEvent, hideHiddenFiles: boolean): void => {
	if (latestShiftSelected && elementIndex(latestShiftSelected) > elementIndex(latestSelected)) latestShiftSelected = latestSelected;

	e.preventDefault();
	const totalGridInArrow = Math.floor(
		(latestSelected.parentNode as HTMLElement).offsetWidth /
			(latestSelected.offsetWidth + parseInt(getComputedStyle(latestSelected).marginLeft) * 2)
	); // Calculate the total of grids in arrow
	const siblings = latestSelected.parentNode.children;
	let elementAbove = siblings[Array.from(siblings).indexOf(e.shiftKey ? latestShiftSelected : latestSelected) - totalGridInArrow] as HTMLElement;
	if (hideHiddenFiles) {
		while (elementAbove && elementAbove.dataset.isHidden === 'true') {
			elementAbove = siblings[Array.from(siblings).indexOf(elementAbove) - totalGridInArrow] as HTMLElement;
		}
	}
	if (elementClassNameContains(elementAbove, /file/)) {
		ensureElementInViewPort(elementAbove);
		let start = false;
		unselectAllSelected();
		if (e.shiftKey) {
			for (const sibling of latestSelected.parentNode.children) {
				if (start || sibling === elementAbove || sibling === latestSelected) {
					if (!(hideHiddenFiles && (sibling as HTMLElement).dataset.isHidden === 'true')) sibling.classList.add('selected');
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
		ChangeSelectedEvent();
	}
};

export { Select, SelectInit, getSelected, ChangeSelectedEvent, unselectAllSelected };
