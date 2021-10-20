import DirectoryAPI from '../../Api/directory';
import FileAPI from '../../Api/files';
import LocalesAPI from '../../Api/locales';

interface LangSrcType {
	[key: string]: string;
}

/**
 * Translate a source into user's preferenced language
 * @param {string} source - The source you want to be translated
 * @returns {Promise<string>} translated string
 */
const Translate = async (source: string): Promise<string> => {
	// Read available language
	const localesInformation = new LocalesAPI();
	await localesInformation.build();
	const files = await new DirectoryAPI(
		localesInformation.LOCALES_FOLDER
	).getFilesWithName();
	const lang =
		JSON.parse(localStorage.getItem('preference'))?.language ??
		navigator.language;
	for (const file of files) {
		// Check if the inputed lang available
		if (file.name.indexOf(lang) !== -1) {
			// Read the language file
			const langSrc = (await new FileAPI(
				file.path
			).readJSONFile()) as unknown as LangSrcType;
			// Replace all text
			Object.keys(langSrc).forEach((key) => {
				if (source === key) source = langSrc[key];
			});
			// Return translated text
			return source;
		}
	}
	return source; // Return translated text*/
};

export default Translate;
