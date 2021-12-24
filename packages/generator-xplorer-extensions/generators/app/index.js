const Generator = require('yeoman-generator');
const yosay = require('yosay');
module.exports = class extends Generator {
	static answers;
	constructor(args, opts) {
		super(args, opts);
		this.argument('extensionType', {
			type: String,
			required: false,
			description: 'Type of the extension',
		});
	}

	async prompting() {
		this.log(yosay(`Welcome to  ${"Xplorer's theme package"} generator !`));
		const answers = this.answers ?? {};
		if (!this.options['extensionType'] || this.options['extensionType'] !== 'theme') {
			const { extensionType } = await this.prompt([
				{
					type: 'list',
					name: 'extensionType',
					message: 'What type of extension do you want to create?',
					choices: [
						{
							name: 'New Color Theme',
							value: 'theme',
						},
					],
				},
			]);
			answers['extensionType'] = extensionType;
		} else {
			answers['extensionType'] = this.options['extensionType'];
		}
		const { extensionName, extensionIdentifier } = await this.prompt([
			{
				type: 'input',
				name: 'extensionName',
				message: "What's the name of your extension?",
				loop: false,
				validate: (name) => name.length > 0,
			},

			{
				type: 'input',
				name: 'extensionIdentifier',
				message: "What's the identifier of your extension?",
				loop: false,
				validate: (name) => name.length > 0 && !/[\W]/.test(name),
			},
		]);
		answers['extensionName'] = extensionName;
		answers['extensionIdentifier'] = extensionIdentifier;
		if (answers['extensionType'] === 'theme') {
			const { themeCategory } = await this.prompt([
				{
					type: 'list',
					name: 'themeCategory',
					message: 'Select a starter theme',
					choices: [
						{ name: 'light', value: 'light' },
						{ name: 'dark', value: 'dark' },
					],
				},
			]);
			answers['themeCategory'] = themeCategory;
		}
		const { gitInit } = await this.prompt([
			{
				type: 'confirm',
				name: 'gitInit',
				message: 'Initialize a git repo',
			},
		]);
		answers['gitInit'] = gitInit;
		this.answers = answers;
	}

	writing() {
		const templateData = {
			...this.answers,
			...this.options,
		};
		this.fs.copyTpl(this.templatePath('package.json'), this.destinationPath('package.json'), templateData);
		this.fs.copyTpl(this.templatePath('gitignore'), this.destinationPath('.gitignore'), templateData);
		this.fs.copyTpl(this.templatePath('README.md'), this.destinationPath('README.md'), templateData);
		this.fs.copyTpl(
			this.answers['themeCategory'] === 'light' ? this.templatePath('light-theme.json') : this.templatePath('dark-theme.json'),
			this.destinationPath(`./themes/${this.answers['extensionIdentifier']}-color-theme.json`),
			templateData
		);
		if (this.answers['gitInit']) {
			this.spawnCommandSync('git', ['init', '--quiet']);
		}
	}
};
