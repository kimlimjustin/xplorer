/**
 * URLify HTML text
 * @param {string} string - String of the HTML inners.
 * @returns {string} URLified HTML text.
 */
const URLify = (string: string): string => {
	const regex = />((((ftp|https?):\/\/)|(w{3}\.))[-\w@:%_+.~#?,&//=]+)/g;
	return string.replace(
		regex,
		'><a href="$1" class="exturl" target="_blank">$1</a>'
	);
};

/**
 * Replace <a> targeting self with <a> targeting external to open link on browser.
 * @param {string} string - String of the HTML inners.
 * @returns {string} eURLified HTML text.
 */
const eURLify = (string: string): string => {
	const _el = document.createElement('div');
	_el.innerHTML = string;
	_el.querySelectorAll('a').forEach((a) => {
		if (a.getAttribute('target') !== '_blank') {
			a.setAttribute('target', '_blank');
		}
	});
	return _el.innerHTML;
};

export { URLify, eURLify };
