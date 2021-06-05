"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
switch (process.platform) {
    case "win32":
        var module = require('../../build/Release/module');
        exports.extractIcon = module.extractIcon;
        exports.readDir = module.readDir;
        break;
    default:
        exports.extractIcon = null;
        exports.readDir = (dir) => {
            const fs = require('fs');
            const path = require('path');
            return fs.readdirSync(dir, { withFileTypes: true })
                .map(dirent => {
                    const stat = fs.statSync(path.join(dir, dirent.name))
                    return { "filename": dirent.name, "isDir": dirent.isDirectory(), "isHidden": /(^|\/)\.[^\/\.]/g.test(dirent.name), "size": stat.size, "createdAt": stat.ctime, "modifiedAt": stat.mtime, "accessedAt": stat.atime }
                })
        }
}