// After pulling crowdin translations, make the translations folder under docs/i18n/ to use two letter code for the name instead of locale name, except for locales that share the same two letter code

const fs = require('fs');
const path = require('path');

const withDuplicateCode = [];
const temp = [];

fs.readdirSync(path.join(__dirname, '../docs/i18n/')).forEach((file) => {
	if (temp.indexOf(file.slice(0, 2)) !== -1) {
		withDuplicateCode.push(file.slice(0, 2));
	} else {
		temp.push(file.slice(0, 2));
	}
});

fs.readdirSync(path.join(__dirname, '../docs/i18n/')).forEach((file) => {
	if (withDuplicateCode.indexOf(file.slice(0, 2)) === -1) {
		fs.renameSync(path.join(__dirname, '../docs/i18n/', file), path.join(__dirname, '../docs/i18n/', file.slice(0, 2)));
	}
});

// Also, update the locale list in the docs/docusaurus.config.js file
const localeList = [];
fs.readdirSync(path.join(__dirname, '../docs/i18n/')).forEach((file) => {
	localeList.push(file);
});

const configFile = fs.readFileSync(path.join(__dirname, '../docs/docusaurus.config.js'), 'utf8');
const newConfigFile = configFile.replace(/locales: \[(.*)\]/, `locales: ['${localeList.join("', '")}']`);
fs.writeFileSync(path.join(__dirname, '../docs/docusaurus.config.js'), newConfigFile);
