/**
 * Enable dragging element
 * @param {HTMLElement} elmnt - draggable element
 * @param {HTMLElement} parentElement - parent element of the draggable element
 * @returns {void}
 */
function dragElement(elmnt: HTMLElement, parentElement: HTMLElement): void {
	let pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0;
	elmnt.onmousedown = dragMouseDown;

	function dragMouseDown(e: MouseEvent) {
		e = e || (window.event as MouseEvent);
		e.preventDefault();
		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.onmouseup = closeDragElement;
		// call a function whenever the cursor moves:
		document.onmousemove = elementDrag;
	}

	function elementDrag(e: MouseEvent) {
		e = e || (window.event as MouseEvent);
		e.preventDefault();
		// calculate the new cursor position:
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;
		const x = parentElement.offsetLeft - parentElement.offsetWidth / 2;
		const y = parentElement.offsetTop - parentElement.offsetHeight / 2;
		// set the element's new position:
		if (
			y - pos2 >= 0 &&
			y + parentElement.offsetHeight - pos2 <= window.innerHeight
		)
			parentElement.style.top = parentElement.offsetTop - pos2 + 'px';
		if (
			x - pos1 >= 0 &&
			x + parentElement.offsetWidth - pos1 <= window.innerWidth
		)
			parentElement.style.left = parentElement.offsetLeft - pos1 + 'px';
	}

	function closeDragElement() {
		/* stop moving when mouse button is released:*/
		document.onmouseup = null;
		document.onmousemove = null;
	}
}
export default dragElement;
