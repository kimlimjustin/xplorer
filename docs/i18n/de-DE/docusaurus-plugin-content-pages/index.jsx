import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';

export default function Home() {
	const { siteConfig } = useDocusaurusContext();
	return (
		<Layout
			title={`Hello from ${siteConfig.title}`}
			description="Xplorer, an easy-to-use, customizable, modern file manager."
		>
			<div className="container">
				<div className="row padding-top--xl padding-bottom--xl banner">
					<div className="col col--4 welcome--section">
						<h1 className="banner--title">File Explorer.</h1>
						<h1 className="banner--subtitle">Redefined.</h1>
						<h2 className="banner--description">
							Free and Open Source Software. Runs everywhere.
						</h2>
						<div className="padding-top--l padding-bottom--l">
							<a
								className="btn margin--sm"
								href="https://github.com/kimlimjustin/xplorer/releases"
								target="_blank"
							>
								Download now
							</a>
							<a
								href="/docs/intro"
								className="margin--sm explore--docs--link"
							>
								Xplorer the docs -{'>'}
							</a>
						</div>
					</div>
					<div className="col col--8">
						{/*<img
							src="/img/Xplorer win.png"
							alt="Xplorer app on Windows 11"
						/>*/}
						<Slideshow></Slideshow>
					</div>
				</div>
				<div className="padding-top--xl built-with-web padding-bottom--xl">
					<h1>
						Cross-platform File Explorer.{' '}
						<em>Powered by the web.</em>
					</h1>
					<span>
						Built using the{' '}
						<a href="https://www.electronjs.org/" target="_blank">
							Electron
						</a>{' '}
						, based on{' '}
						<a href="https://www.chromium.org/" target="_blank">
							Chromium
						</a>
						, and written using{' '}
						<a
							href="https://www.typescriptlang.org/"
							target="_blank"
						>
							TypeScript
						</a>{' '}
						, Xplorer promises you an unprecedented experience.
					</span>
					<div className="row padding-top--xl features--list">
						<div className="col col--4 padding-left--m padding-right--m">
							<img
								src="/img/home/designed-out-of-the-box.png"
								alt="Xplorer designed out of the box"
							/>
							<h2>Designed out of the box</h2>
							<p>
								Say goodbye to the old design by traditional app
								and say hello to this simple yet powerful
								design.
							</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img
								src="/img/home/support-tabs.png"
								alt="Support tabs"
							/>
							<h2>Supports Multiple Tabs</h2>
							<p>
								Xplorer helps you oraganize you files easier by
								supporting multiple tabs .
							</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/preview-files.png" alt="" />
							<h2>File Preview</h2>
							<p>
								Xplorer supports files preview, even videos!
								Learn more{' '}
								<a
									href="/docs/guides/file%20operation/#preview"
									target="_blank"
								>
									here
								</a>
								.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
}
