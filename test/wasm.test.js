const { readDir, extractIcon } = require("../lib/wasm/bindings");
const path = require('path');
const fs = require('fs');

test('read files in directory', () => {
    expect(readDir(__dirname)[process.platform === "win32" ? 2 : 0].filename).toBe(path.basename(__filename))
})

if (process.platform === "win32") {
    test('Extract exe icon', () => {
        const buffer = extractIcon("C:\\Windows\\System32\\cmd.exe", "large");
        fs.writeFileSync("test.ico", buffer);
        fs.unlinkSync("test.ico")
    })
}