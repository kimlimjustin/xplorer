const cpy = require('cpy');
const process = require('process');

(async () => {
	await cpy(
		['src/**/*', '!src/**/*.ts', 'src/lib/**/*', 'build/**/*'],
		'outs',
		{
			parents: true,
		}
	);
})();
