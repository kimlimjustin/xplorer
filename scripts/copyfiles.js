const cpy = require('cpy');
const process = require('process');

(async () => {
	await cpy(
		[
			'src/**/*',
			'!src/**/*.ts',
			'src/lib/**/*',
			'build/**/*',
			'!src/**/*.scss',
		],
		'outs',
		{
			parents: true,
		}
	);
})();
