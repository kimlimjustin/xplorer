const path = require('path');
const fs = require('fs');
const storage = require('electron-json-storage-sync');

const getIcon = (category, variable) => {
    const defaultIconJSON = JSON.parse(fs.readFileSync(path.join(__dirname, "../../", "config/icon.json")));
    let iconJSON = null;
    // Get user preference on icon
    const icon  = storage.get('icon')
    if(icon.data && fs.existsSync(icon.data.iconJSON)) iconJSON = JSON.parse(fs.readFileSync(icon.data.iconJSON))

    if(iconJSON){
        let fileLoc = iconJSON[category][variable][0] === "/" ? iconJSON[category][variable] : path.join(icon.data.iconJSON, '../', iconJSON[category][variable]) // File loc for user preference based icon
        // If user preference icon exist ....
        if(fs.existsSync(fileLoc)){
            // Return it
            return path.resolve(fileLoc)
        }
    }
    // Else return Xplorer default icon
    return path.resolve(path.join(__dirname, "../../icon/", defaultIconJSON[category][variable]))
}

module.exports = getIcon