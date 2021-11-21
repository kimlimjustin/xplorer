import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';
import Link from '@docusaurus/Link';

export default function Home() {
	const { siteConfig } = useDocusaurusContext();
	return (
		<Layout title={`Hello from ${siteConfig.title}`} description="Xplorer, an easy-to-use, customizable, modern file manager.">
			<div className="container">
				<div className="row padding-top--xl padding-bottom--xl banner">
					<div className="col col--4 welcome--section">
						<h1 className="banner--title">Datei-Explorer.</h1>
						<h1 className="banner--subtitle">Neudefiniert.</h1>
						<h2 className="banner--description">Free and Open Source Software. Runs everywhere.</h2>
						<div className="padding-top--l padding-bottom--l">
							<a className="btn margin--sm" href="https://github.com/kimlimjustin/xplorer/releases" target="_blank">
								Jetzt herunterladen
							</a>
							<Link to="/docs/intro" className="margin--sm explore--docs--link">
								Xplorer die Dokumentation -{'>'}
							</Link>
						</div>
					</div>
					<div className="col col--8">
						<Slideshow />
					</div>
				</div>
				<div className="padding-top--xl built-with-web padding-bottom--xl">
					<h1>
						Cross-platform File Explorer. <em>Unterstützt durch das Web.</em>
					</h1>
					<span>
						Erstellt mit{' '}
						<a href="https://tauri.studio" target="_blank">
							Tauri Framework
						</a>{' '}
						, und geschrieben mit{' '}
						<a href="https://www.typescriptlang.org/" target="_blank">
							TypeScript
						</a>{' '}
						for the frontend and{' '}
						<a href="https://www.rust-lang.org/" target="_blank">
							Rust
						</a>{' '}
						for the backend, Xplorer promises you an unprecedented experience.
					</span>
					<div className="row padding-top--xl features--list">
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/designed-out-of-the-box.png" alt="Xplorer designed out of the box" />
							<h2>Designed out of the box</h2>
							<p>Say goodbye to the old design by traditional app and say hello to this simple yet powerful design.</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/support-tabs.png" alt="Support tabs" />
							<h2>Unterstützt mehrere Tabs</h2>
							<p>Xplorer helps you organize you files easier by supporting multiple tabs .</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/preview-files.png" alt="" />
							<h2>Dateivorschau</h2>
							<p>
								Xplorer supports files preview, from images, code preview, pdfs, to videos. Erfahren Sie mehr{' '}
								<Link to="/docs/guides/operation/#preview-file">here</Link>.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
}
