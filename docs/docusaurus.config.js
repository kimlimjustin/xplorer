const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
	title: 'Xplorer',
	tagline: 'An easy-to-use, customizable, modern file manager',
	url: 'https://xplorer.vercel.app',
	baseUrl: '/',
	onBrokenLinks: 'throw',
	onBrokenMarkdownLinks: 'warn',
	favicon: 'img/favicon.ico',
	organizationName: 'kimlimjustin',
	projectName: 'xplorer',
	trailingSlash: true,
	i18n: {
		defaultLocale: 'en',
		locales: ['en', 'id-ID', 'ja-JP', 'zh-CN'],
	},
	themeConfig: {
		hideableSidebar: true,
		announcementBar: {
			id: 'support_us',
			content:
				'Xplorer is still under heavy development, docs here may not up to date.',
			backgroundColor: '#fafbfc',
			textColor: '#091E42',
		},
		navbar: {
			hideOnScroll: true,
			title: 'Xplorer',
			logo: {
				alt: 'Xplorer Logo',
				src: 'img/icon.svg',
			},
			items: [
				{
					type: 'doc',
					docId: 'intro',
					position: 'left',
					label: 'Tutorial',
				},
				{ to: '/blog', label: 'Blog', position: 'left' },
				{
					to: '/community/support',
					label: 'Community',
					position: 'left',
				},
				{
					type: 'localeDropdown',
					position: 'right',
					dropdownItemsAfter: [
						{
							href: 'https://github.com/kimlimjustin/xplorer/discussions/30',
							label: 'Help Us Translate',
						},
					],
				},
				{
					href: 'https://github.com/kimlimjustin/xplorer',
					label: 'GitHub',
					position: 'right',
				},
			],
		},
		footer: {
			links: [
				{
					title: 'Docs',
					items: [
						{
							label: 'Tutorial',
							to: '/docs/intro',
						},
					],
				},
				{
					title: 'Community',
					items: [
						{
							label: 'GitHub Discussions',
							href: 'https://github.com/kimlimjustin/xplorer/discussions',
						},
					],
				},
			],
			copyright: `Copyright © ${new Date().getFullYear()} Justin Maximillian Kimlim and <a href="https://github.com/kimlimjustin/xplorer/graphs/contributors" target="_blank">contributors</a>. Website Built with <a href="https://docusaurus.io" target="_blank">Docusaurus</a>.`,
		},
		prism: {
			theme: lightCodeTheme,
			darkTheme: darkCodeTheme,
		},
		zoomSelector: '.markdown :not(em) > img',
	},
	presets: [
		[
			'@docusaurus/preset-classic',
			{
				docs: {
					sidebarPath: require.resolve('./sidebars.js'),
					editUrl: ({ locale, docPath }) => {
						if (locale === 'en') {
							return `https://github.com/kimlimjustin/xplorer/edit/master/docs/docs/${docPath}`;
						} else {
							return `https://crowdin.com/project/xplorer`;
						}
					},
					showLastUpdateAuthor: true,
					showLastUpdateTime: true,
				},
				blog: {
					showReadingTime: true,
					editUrl: ({ locale, blogPath }) => {
						if (locale === 'en') {
							return `https://github.com/kimlimjustin/xplorer/edit/master/docs/blog/${blogPath}`;
						} else {
							return `https://crowdin.com/project/xplorer`;
						}
					},
					feedOptions: {
						type: 'all',
						copyright: `Copyright © ${new Date().getFullYear()} Justin Maximillian Kimlim and <a href="https://github.com/kimlimjustin/xplorer/graphs/contributors" target="_blank">contributors</a>.`,
					},
				},
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			},
		],
	],
	plugins: [
		'plugin-image-zoom',
		[
			'@docusaurus/plugin-content-docs',
			{
				path: 'community',
				id: 'community',
				routeBasePath: 'community',
				editUrl: ({ locale, docPath }) => {
					if (locale === 'en') {
						return `https://github.com/kimlimjustin/xplorer/edit/master/docs/community/${docPath}`;
					} else {
						return `https://crowdin.com/project/xplorer`;
					}
				},
				showLastUpdateAuthor: true,
				showLastUpdateTime: true,
			},
		],
		[
			'@docusaurus/plugin-pwa',
			{
				debug: true,
				offlineModeActivationStrategies: [
					'appInstalled',
					'standalone',
					'queryString',
				],
				pwaHead: [
					{
						tagName: 'link',
						rel: 'icon',
						href: '/img/icon.png',
					},
					{
						tagName: 'link',
						rel: 'manifest',
						href: '/manifest.json',
					},
					{
						tagName: 'meta',
						name: 'theme-color',
						content: '#0081cb',
					},
				],
			},
		],
	],
};
