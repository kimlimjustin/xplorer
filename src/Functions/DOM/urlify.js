function URLify(string){
  var regex = />((((ftp|https?):\/\/)|(w{3}\.))[\-\w@:%_\+.~#?,&\/\/=]+)/g
  return string.replace(regex, '><a href="$1" class="exturl" target="_blank">$1</a>');
}

module.exports = URLify