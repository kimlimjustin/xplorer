const watch = require('node-watch');
const spawn = require('cross-spawn');

watch('src/Components', { recursive: true, filter: /\.ejs/ }, () => {
	console.log('a');
	spawn('yarn', ['copyfiles']);
});
