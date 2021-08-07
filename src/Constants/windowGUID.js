const { ipcRenderer } = require("electron");
console.log(ipcRenderer)

const guid = () => {
    const s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    //return id of format 'aaaaaaaa'-'aaaa'-'aaaa'-'aaaa'-'aaaaaaaaaaaa'
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
const windowGUID = guid()
ipcRenderer.send("GUID", windowGUID)

module.exports = windowGUID