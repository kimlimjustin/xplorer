import Generator from 'yeoman-generator';
import { green } from 'chalk';
import yosay from 'yosay';
interface Arguments {
	themeName: string;
}

interface Answers extends Arguments {
	themeCategory: 'light' | 'dark';
	packageName: 'string';
	gitInit: boolean;
}

module.exports = class extends Generator {
	answers: Answers;
	constructor(args, opts: Arguments) {
		super(args, opts);
		this.argument('themeName', {
			type: String,
			required: false,
			description: 'Your theme name',
		});
	}

	async prompting() {
		this.log(
			yosay(`Welcome to  ${green("Xplorer's theme package")} generator !`)
		);
		const answers = this.answers ?? {};
		if (!this.options['themeName']) {
			const { themeName } = await this.prompt([
				{
					type: 'input',
					name: 'themeName',
					message: 'Your theme name:',
					loop: false,
					validate: (name) => name.length > 0,
				},
			]);
			answers['themeName'] = themeName;
			answers['packageName'] = themeName
				.toLowerCase()
				.replace(/[\W]/, '-');
		} else {
			answers['packageName'] = this.options['themeName']
				.toLowerCase()
				.replace(/[\W]/, '-');
		}
		const { themeCategory, gitInit } = await this.prompt([
			{
				type: 'list',
				name: 'themeCategory',
				message: 'Theme category',
				choices: [
					{ name: 'light', value: 'light' },
					{ name: 'dark', value: 'dark' },
				],
			},

			{
				type: 'confirm',
				name: 'gitInit',
				message: 'Initialize a git repo',
			},
		]);
		answers['themeCategory'] = themeCategory;
		answers['gitInit'] = gitInit;
		this.answers = answers as Answers;
	}

	writing() {
		const templateData = {
			...this.answers,
			...this.options,
		};
		this.fs.copyTpl(
			this.templatePath('package.ejs'),
			this.destinationPath('package.json'),
			templateData
		);
		this.fs.copyTpl(
			this.templatePath('themes.ejs'),
			this.destinationPath(`${this.answers['packageName']}.json`),
			templateData
		);
		if (this.answers['gitInit']) {
			this.spawnCommandSync('git', ['init', '--quiet']);
		}
	}
};
