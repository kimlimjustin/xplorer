import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';
import Link from '@docusaurus/Link';

export default function Home() {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout
            title={`Hallo von ${siteConfig.title}`}
            description="Xplorer, ein einfacher, modifizierbarer, moderner Datei-Verwalter."
        >
            <div className="container">
                <div className="row padding-top--xl padding-bottom--xl banner">
                    <div className="col col--4 welcome--section">
                        <h1 className="banner--title">Datei-Explorer.</h1>
                        <h1 className="banner--subtitle">Neudefiniert.</h1>
                        <h2 className="banner--description">
                            Kostenfreie und open-source Software. Läuft überall.
                        </h2>
                        <div className="padding-top--l padding-bottom--l">
                            <a
                                className="btn margin--sm"
                                href="https://github.com/kimlimjustin/xplorer/releases"
                                target="_blank"
                            >
                                Jetzt herunterladen
                            </a>
                            <Link
                                to="/docs/intro"
                                className="margin--sm explore--docs--link"
                            >
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
                        Cross-Platform Datei-Explorer.{' '}
                        <em>Unterstützt durch das Web.</em>
                    </h1>
                    <span>
                        Erstellt mit{' '}
                        <a href="https://www.electronjs.org/" target="_blank">
                            Electron
                        </a>{' '}
                        , basierend auf{' '}
                        <a href="https://www.chromium.org/" target="_blank">
                            Chromium
                        </a>
                        , und geschrieben mit{' '}
                        <a
                            href="https://www.typescriptlang.org/"
                            target="_blank"
                        >
                            TypeScript
                        </a>{' '}
                        , Xplorer verspricht Ihnen eine beispiellose Erfahrung.
                    </span>
                    <div className="row padding-top--xl features--list">
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img
                                src="/img/home/designed-out-of-the-box.png"
                                alt="Xplorer wurde out of the box entworfen"
                            />
                            <h2>Designed out of the box</h2>
                            <p>
                                Sagen Sie sich vom alten Design der traditionellen App ab
                                und sagen Sie Hallo zu diesem einfachen aber leistungsstarken
                                Design.
                            </p>
                        </div>
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img
                                src="/img/home/support-tabs.png"
                                alt="Unterstützt Tabs"
                            />
                            <h2>Unterstützt mehrere Tabs</h2>
                            <p>
                                Xplorer helps you organize you files easier by
                                das Unterstützen mehrerer Tabs zu organisieren .
                            </p>
                        </div>
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img src="/img/home/preview-files.png" alt="" />
                            <h2>Dateivorschau</h2>
                            <p>
                                Xplorer unterstützt Dateivorschau, sogar Videos!
                                Erfahren Sie mehr{' '}
                                <Link to="/docs/guides/operation/#preview-file">
                                    hier
                                </Link>
                                .
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
