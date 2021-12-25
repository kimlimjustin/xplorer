import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
export default function Home() {
	const { siteConfig } = useDocusaurusContext();
	return (
		<Layout title={`Hello from ${siteConfig.title}`} description="Xplorer, an easy-to-use, customizable, modern file manager.">
			<div className="container">
				<div className="row padding-top--xl padding-bottom--xl banner">
					<div className="col col--4 welcome--section">
						<h1 className="banner--title">
							<Translate id="welcome.title"> File Explorer.</Translate>
						</h1>
						<h1 className="banner--subtitle">
							<Translate id="welcome.keyword"> Redefined.</Translate>
						</h1>
						<h2 className="banner--description">
							<Translate id="welcome.description">Free and Open Source Software. Runs everywhere.</Translate>
						</h2>

						<div className="padding-top--l padding-bottom--l">
							<a className="btn margin--sm" href="https://github.com/kimlimjustin/xplorer/releases" target="_blank">
								<Translate id="welcome.download"> Download now</Translate>
							</a>
							<Link to="/docs/intro" className="margin--sm explore--docs--link">
								<Translate id="welcome.xploreTheDocs">Read documentation</Translate>
							</Link>
						</div>
					</div>

					<div className="col col--8">
						<Slideshow />
					</div>
				</div>

				<div className="padding-top--xl built-with-web padding-bottom--xl">
					<h1>
						<Translate id="about.title">Cross-platform File Explorer.</Translate>
						<em>
							<Translate id="about.poweredByTheWebTitle">Powered by the web.</Translate>
						</em>
					</h1>

					<span>
						<Translate id="about.builtUsing">Built using the </Translate>
						<a href="https://tauri.studio" target="_blank">
							Tauri Framework
						</a>{' '}
						<Translate id="about.written">, and written using </Translate>
						<a href="https://www.typescriptlang.org/" target="_blank">
							TypeScript
						</a>{' '}
						<Translate id="about.typescriptUsage">for the frontend and </Translate>
						<a href="https://www.rust-lang.org/" target="_blank">
							Rust
						</a>{' '}
						<Translate id="about.rustUsage">for the backend</Translate>,{' '}
						<Translate id="about.promise">Xplorer promises you an unprecedented experience.</Translate>
					</span>

					<div className="row padding-top--xl features--list">
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/designed-out-of-the-box.webp" alt="Xplorer designed out of the box" />
							<h2>
								<Translate id="feature.design"> Designed out of the box</Translate>
							</h2>
							<p>
								<Translate id="feature.designDescription">
									Say goodbye to the old design by traditional app and say hello to this simple yet powerful design.
								</Translate>
							</p>
						</div>

						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/support-tabs.webp" alt="Support tabs" />
							<h2>
								<Translate id="feature.multipleTabs">Supports Multiple Tabs</Translate>
							</h2>
							<p>
								<Translate id="feature.multipleTabsDescription">
									Xplorer helps you organize you files easier by supporting multiple tabs .
								</Translate>
							</p>
						</div>

						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/preview-files.webp" alt="" />
							<h2>
								<Translate id="feature.filePreview"> File Preview</Translate>
							</h2>
							<p>
								<Translate id="feature.filePreviewDescription">
									Xplorer supports files preview, from images, code preview, pdfs, to videos. Learn more
								</Translate>
								<Link to="/docs/guides/operation/#preview-file">here</Link>.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
}
