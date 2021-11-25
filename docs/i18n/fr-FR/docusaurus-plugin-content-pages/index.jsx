import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';
import Link from '@docusaurus/Link';

export default function Home() {
	const { siteConfig } = useDocusaurusContext();
	return (
		<Layout title={`Bonjour de ${siteConfig.title}`} description="Xplorer, facile à utiliser.">
			<div className="container">
				<div className="row padding-top--xl padding-bottom--xl banner">
					<div className="col col--4 welcome--section">
						<h1 className="banner--title">Explorateur de fichiers.</h1>
						<h1 className="banner--subtitle">Redéfini.</h1>
						<h2 className="banner--description">Logiciel libre et Open Source. Fonctionne partout.</h2>
						<div className="padding-top--l padding-bottom--l">
							<a className="btn margin--sm" href="https://github.com/kimlimjustin/xplorer/releases" target="_blank">
								Télécharger maintenant
							</a>
							<Link to="/docs/intro" className="margin--sm explore--docs--link">
								Xplorer les documentations -{'>'}
							</Link>
						</div>
					</div>
					<div className="col col--8">
						<Slideshow />
					</div>
				</div>
				<div className="padding-top--xl built-with-web padding-bottom--xl">
					<h1>
						Explorateur de fichiers multiplateforme. <em>Propulsé par le web.</em>
					</h1>
					<span>
						Conçue avec {' '}
						<a href="https://tauri.studio" target="_blank">
							Tauri Framework
						</a>{' '}
						, et écrit en{' '}
						<a href="https://www.typescriptlang.org/" target="_blank">
							TypeScript
						</a>{' '}
						pour le frontend et{' '}
						<a href="https://www.rust-lang.org/" target="_blank">
							Rust
						</a>{' '}
						pour le backend, Xplorer vous promet une expérience sans précédent.
					</span>
					<div className="row padding-top--xl features--list">
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/designed-out-of-the-box.png" alt="Xplorer unique de lui même" />
							<h2>Conçu hors de la boîte</h2>
							<p>Dites adieu à l'ancien design par application traditionnelle et dites bonjour à ce design simple mais puissant.</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/support-tabs.png" alt="Support tabs" />
							<h2>Prise en charge de plusieurs onglets</h2>
							<p>Xplorer vous aide à organiser vos fichiers plus facilement en prenant en charge plusieurs onglets.</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/preview-files.png" alt="" />
							<h2>Aperçu du fichier</h2>
							<p>
								Xplorer supporte l'aperçu des fichiers, depuis les images, l'aperçu du code, les pdfs, jusqu'aux vidéos. En savoir plus{' '}
								<Link to="/docs/guides/operation/#preview-file">ici</Link>.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
}
