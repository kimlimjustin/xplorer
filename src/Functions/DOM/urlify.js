/**
 * URLify HTML text
 * @param {String} string - String of the HTML inners.
 * @returns {String} URLified HTML text.
 */
const URLify = string => {
  var regex = />((((ftp|https?):\/\/)|(w{3}\.))[\-\w@:%_\+.~#?,&\/\/=]+)/g
  return string.replace(regex, '><a href="$1" class="exturl" target="_blank">$1</a>');
}

/**
 * Replace <a> targeting self with <a> targeting external to open link on browser.
 * @param {String} string - String of the HTML inners.
 * @returns {String} eURLified HTML text.
 */
const eURLify = string => {
  let _el = document.createElement("div")
  _el.innerHTML = string
  _el.querySelectorAll('a').forEach(a => {
    if (a.getAttribute("target") !== "_blank") {
      a.setAttribute("target", "_blank")
    }
  })
  return _el.innerHTML
}

module.exports = { URLify, eURLify }