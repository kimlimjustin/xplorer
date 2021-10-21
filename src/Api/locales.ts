import localesInformation from '../Locales/index.json';

interface AvailableLocalesType {
	[key: string]: string;
}

interface Locales {
	[key: string]: {
		[key: string]: string;
	};
}
class LocalesAPI {
	AVAILABLE_LOCALES: AvailableLocalesType;
	LOCALES: Locales;
	constructor() {
		this.LOCALES = {};
	}
	async build(): Promise<void> {
		this.AVAILABLE_LOCALES = localesInformation.availableLanguages;
		for (const locale of Object.values(this.AVAILABLE_LOCALES)) {
			const localeJSON = await import(
				'../Locales/' + (locale === 'en-US' ? 'base' : locale) + '.json'
			);
			this.LOCALES[locale] = localeJSON;
		}
	}
}

export default LocalesAPI;
