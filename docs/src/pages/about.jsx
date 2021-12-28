import Slideshow from '../util/slideshow';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import React from 'react';
import { Check } from '../util/icon';
const PoweredByTheWeb = () => {
	return (
		<div className="padding-top--xl powered-by-web padding-bottom--l">
			<h1>
				<Translate id="about.title">Cross-platform File Explorer.</Translate>
				<em className=" margin-vert--md">
					<Translate id="about.poweredByTheWebTitle">Powered by the web</Translate> <Check />
				</em>
			</h1>

			<span className="powered-by-web--desc">
				<Translate id="about.builtUsing">Being built using the</Translate>{' '}
				<a href="https://tauri.studio" target="_blank">
					Tauri Framework
				</a>
				<Translate id="about.written">, and written using</Translate>{' '}
				<a href="https://www.typescriptlang.org/" target="_blank">
					TypeScript
				</a>{' '}
				<Translate id="about.typescriptUsage">for the frontend and</Translate>{' '}
				<a href="https://www.rust-lang.org/" target="_blank">
					Rust
				</a>{' '}
				<Translate id="about.rustUsage">for the backend</Translate>,{' '}
				<Translate id="about.promise">Xplorer promises you an unprecedented experience.</Translate>
			</span>
			<div className="row margin-top--lg">
				<div className="col col--6 padding--lg">
					<Slideshow />
				</div>
				<div className="col col--6 padding--md features-container">
					<div className="feature margin-bottom--md">
						<h2>
							<Translate id="feature.multipleTabs">Supports Multiple Tabs</Translate>
						</h2>
						<p>
							<Translate id="feature.multipleTabsDescription">
								Tired of opening multiple windows to explore your files? Xplorer comes with multiple tabs support to help you manage
								your files easier.
							</Translate>
						</p>
					</div>
					<div className="feature margin-bottom--md">
						<h2>
							<Translate id="feature.filePreview">File Preview</Translate>
						</h2>
						<p>
							<Translate id="feature.filePreviewDescriptionPart1">Xplorer comes with a</Translate>{' '}
							<Link to="/docs/guides/operation/#preview-file">
								<Translate id="feature.filePreviewDescriptionPart2">built-in file previewer</Translate>
							</Link>{' '}
							<Translate id="feature.filePreviewDescriptionPart3">
								to help you view files in a more intuitive way. It supports images, videos, PDFs to almost all programming language
								with Syntax Highlighting.
							</Translate>
						</p>
					</div>
				</div>
			</div>
			<div className="row padding-horiz--lg">
				<div className="col feature padding--md">
					<h2>
						<Translate id="feature.designTitle">Designed out of the box</Translate>
					</h2>
					<p>
						<Translate id="feature.designDescription">
							Say goodbye to the old design by traditional app and say hello to this simple yet powerful design.
						</Translate>
					</p>
				</div>
				<div className="col feature padding--md">
					<h2>
						<Translate id="feature.customizableTitle">Customizable</Translate>
					</h2>
					<p>
						<Translate id="feature.customizableDescriptionPart1">
							You can customize the look and feel of Xplorer by using different themes or
						</Translate>{' '}
						<Link to="/docs/Extensions/create/">
							<Translate id="feature.customizableDescriptionPart2">build your own theme</Translate>
						</Link>
						.
					</p>
				</div>
			</div>
		</div>
	);
};

export default PoweredByTheWeb;
