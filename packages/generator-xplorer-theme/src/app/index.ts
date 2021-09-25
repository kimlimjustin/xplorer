import Generator from 'yeoman-generator';
import { green } from 'chalk';
import yosay from 'yosay';

interface Answers {
	answer1: string;
}

interface Arguments {
	arg1: string;
	arg2: string;
	argRest: string[];
	option1: boolean;
	option2: string;
}

module.exports = class extends Generator<Arguments> {
	answers: Answers;
	constructor(args, opts: Arguments) {
		super(args, opts);

		this.argument('arg1', {
			type: String,
			required: false,
			default: 'arg1default',
			description: 'Argument 1',
		});
		this.argument('arg2', {
			type: String,
			required: false,
			default: 'arg2default',
			description: 'Argument 2',
		});
		this.argument('argRest', {
			type: Array,
			required: false,
			default: [],
			description: 'Rest arguments',
		});

		this.option('option1', {
			type: Boolean,
			default: false,
			description: 'Option 1',
			alias: 'o',
		});
		this.option('option2', {
			type: String,
			default: 'opt2default',
			description: 'Option 2',
			alias: 'p',
		});
	}

	async prompting() {
		this.log(yosay(`Welcome to  ${green("Xplorer's theme")} generator !`));
	}

	writing() {
		const templateData = {
			...this.answers,
			...this.options,
		};
		this.fs.copyTpl(
			this.templatePath('dummyfile.txt'),
			this.destinationPath('dummyfile.txt'),
			templateData
		);
	}

	install() {
		console.log('Nothing to install');
	}
};
