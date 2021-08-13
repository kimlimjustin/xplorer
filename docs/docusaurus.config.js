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
    locales: ['en', 'id', 'ja'],
  },
  themeConfig: {
    hideableSidebar: true,
    announcementBar: {
      id: 'support_us',
      content: '⭐️ If you like Xplorer, give it a star on <a href="https://github.com/kimlimjustin/xplorer">GitHub!</a> ⭐',
      backgroundColor: "#fafbfc",
      textColor: "#091E42"
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
        { to: '/community/support', label: 'Community', position: 'left' },
        { type: 'localeDropdown', position: 'right' },
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
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Justin Maximillian Kimlim. Website Built with <a href="https://docusaurus.io" target="_blank">Docusaurus</a>.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
    },
    zoomSelector: '.markdown :not(em) > img'
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: ({ locale, docPath }) => {
            if (locale === "en") {
              return `https://github.com/kimlimjustin/xplorer/edit/master/docs/${docPath}`;
            } else {
              return `https://github.com/kimlimjustin/xplorer/edit/master/docs/i18n/${locale}/docusaurus-plugin-content-docs/current/${docPath}`
            }
            
          }
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/kimlimjustin/xplorer/edit/master/docs',
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
        routeBasePath: 'community'
      }
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
            href: '/manifest.json', // your PWA manifest
          },
          {
            tagName: 'meta',
            name: 'theme-color',
            content: 'rgb(37, 194, 160)',
          },
        ],
      }
    ],
  ],
};
