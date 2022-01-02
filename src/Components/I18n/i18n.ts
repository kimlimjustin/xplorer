import Storage from '../../Service/storage';
import LocalesAPI from '../../Service/locales';

let localesInformation: LocalesAPI;

/**
 * Translate a source into user's preferenced language
 * @param {string} source - The source you want to be translated
 * @returns {Promise<string>} translated string
 */
const Translate = async (source: string): Promise<string> => {
	// Read available language
	if (!localesInformation?.LOCALES) {
		localesInformation = new LocalesAPI();
		await localesInformation.build();
	}
	const lang = (await Storage.get('preference'))?.language ?? navigator.language;
	for (const locale of Object.values(localesInformation.AVAILABLE_LOCALES)) {
		// Check if the inputed lang available
		if (locale === lang) {
			if (localesInformation.LOCALES[locale]) {
				// Replace all text
				Object.keys(localesInformation.LOCALES[locale]).forEach((key) => {
					if (source === key) source = localesInformation.LOCALES[locale][key];
				});
			}
			// Return translated text
			return source;
		}
	}
	return source; // Return translated text
};

export default Translate;
