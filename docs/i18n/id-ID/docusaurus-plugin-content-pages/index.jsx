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
						<h1 className="banner--title">Penjelajah File</h1>
						<h1 className="banner--subtitle">Redefinisi.</h1>
						<h2 className="banner--description">
							Aplikasi Bebas dan Bersumber Terbuka (Foss). Dapat dijalankan dimana saja.
						</h2>
						<div className="padding-top--l padding-bottom--l">
							<a
								className="btn margin--sm"
								href="https://github.com/kimlimjustin/xplorer/releases"
								target="_blank"
							>
								Unduh sekarang
							</a>
							<a
								href="/docs/intro"
								className="margin--sm explore--docs--link"
							>
								Xplorer the dokumentasi -{'>'}
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
						Penjelajah File Lintas Platform.{' '}
						<em>Bertenaga website</em>
					</h1>
					<span>
						Dibangun dengan menggunakan{' '}
						<a href="https://www.electronjs.org/" target="_blank">
							Electron
						</a>{' '}
						, berbasis{' '}
						<a href="https://www.chromium.org/" target="_blank">
							Chromium
						</a>
						, dan diketik dengan{' '}
						<a
							href="https://www.typescriptlang.org/"
							target="_blank"
						>
							TypeScript
						</a>{' '}
						, Xplorer menjanjikan anda pengalaman yang tidak biasa.
					</span>
					<div className="row padding-top--xl features--list">
						<div className="col col--4 padding-left--m padding-right--m">
							<img
								src="/img/home/designed-out-of-the-box.png"
								alt="Xplorer designed out of the box"
							/>
							<h2><i>Designed out of the box</i></h2>
							<p>
								Katakan sampai jumpa pada desain aplikasi traditional
								dan katakan halo kepada desain yang simple tetapi berguna ini
								.
							</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img
								src="/img/home/support-tabs.png"
								alt="Support tabs"
							/>
							<h2>Mendukung beberapa tab</h2>
							<p>
								Xplorer membantu anda mengatur berkas-berkas anda dengan
								menunjang banyak tab .
							</p>
						</div>
						<div className="col col--4 padding-left--m padding-right--m">
							<img src="/img/home/preview-files.png" alt="" />
							<h2>File Preview</h2>
							<p>
								Xplorer mendukung preview file, bahkan video!
								Pelajari lebih lanjut{' '}
								<a
									href="/docs/guides/file%20operation/#preview"
									target="_blank"
								>
									disini
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
