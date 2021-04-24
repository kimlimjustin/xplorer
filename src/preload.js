const fs = require('fs');
window.addEventListener('DOMContentLoaded', () => {
    const theme = JSON.parse(fs.readFileSync("src/config/theme.json"));
    document.body.style.backgroundColor =  theme.default.mainBackground
    document.body.style.color = theme.default.textColor
    document.body.style.fontSize = theme.default.fontSize
    document.querySelector(".sidebar").style.backgroundColor = theme.default.sidebarBackground
})
  