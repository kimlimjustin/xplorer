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
  organizationName: 'kimlimjustin', // Usually your GitHub org/user name.
  projectName: 'xplorer', // Usually your repo name.
  trailingSlash: true,
  themeConfig: {
    announcementBar: {
      id: 'support_us',
      content: '⭐️ If you like Xplorer, give it a star on <a href="https://github.com/kimlimjustin/xplorer">GitHub!</a> ⭐',
      backgroundColor: "#fafbfc",
      textColor: "#091E42"
    },
    navbar: {
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
          href: 'https://github.com/kimlimjustin/xplorer',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
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
      copyright: `Copyright © ${new Date().getFullYear()} Justin Maximillian Kimlim. Website Built with Docusaurus.`,
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
          editUrl:
            'https://github.com/kimlimjustin/xplorer/edit/master/docs/',
        },
        blog: {
          showReadingTime: true,
          editUrl:
            'https://github.com/kimlimjustin/xplorer/edit/master/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  plugins: [
    'plugin-image-zoom'
  ],
};
