const path = require('path');

module.exports = {
	entry: './src/index.ts',
	mode: 'development',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
			{
				test: /\.svg/,
				type: 'asset/inline',
			},
		],
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js', '.svg'],
	},
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'out/src'),
	},
};
