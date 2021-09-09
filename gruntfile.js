module.exports = function (grunt) {
	grunt.initConfig({
		// define source files and their destinations
		uglify: {
			files: {
				src: ['outs/**/*.js'],
				dest: 'outs',
				expand: true,
				cwd: '.',
				rename: (_, src) => src,
			},
		},
	});

	// load plugins
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	// register at least this one task
	grunt.registerTask('default', ['uglify']);
};
