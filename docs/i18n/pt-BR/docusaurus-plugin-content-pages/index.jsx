import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Slideshow from './slideshow';
import Link from '@docusaurus/Link';

export default function Home() {
    const { siteConfig } = useDocusaurusContext();
    return (
        <Layout
            title={`Olá do ${siteConfig.title}`}
            description="Xplorer, um explorador de arquivos moderno, fácil de usar e totalmente customizável."
        >
            <div className="container">
                <div className="row padding-top--xl padding-bottom--xl banner">
                    <div className="col col--4 welcome--section">
                        <h1 className="banner--title">Explorador de Arquivos</h1>
                        <h1 className="banner--subtitle">Redefinido.</h1>
                        <h2 className="banner--description">
                            Software gratuito e de Código Aberto. Roda em todos os lugares.
                        </h2>
                        <div className="padding-top--l padding-bottom--l">
                            <a
                                className="btn margin--sm"
                                href="https://github.com/kimlimjustin/xplorer/releases"
                                target="_blank"
                            >
                                Baixe agora
                            </a>
                            <Link
                                to="/docs/intro"
                                className="margin--sm explore--docs--link"
                            >
                                Xplore a documentação -{'>'}
                            </Link>
                        </div>
                    </div>
                    <div className="col col--8">
                        <Slideshow />
                    </div>
                </div>
                <div className="padding-top--xl built-with-web padding-bottom--xl">
                    <h1>
                        Explorador de Arquivos Multiplataforma.{' '}
                        <em>Desenvolvido pela web.</em>
                    </h1>
                    <span>
                        Criado usando o{' '}
                        <a href="https://www.electronjs.org/" target="_blank">
                            Electron
                        </a>{' '}
                        , baseado em{' '}
                        <a href="https://www.chromium.org/" target="_blank">
                            Chromium
                        </a>
                        , e escrito usando{' '}
                        <a
                            href="https://www.typescriptlang.org/"
                            target="_blank"
                        >
                            TypeScript
                        </a>{' '}
                        , Xplorer promete uma experiência sem precedentes.
                    </span>
                    <div className="row padding-top--xl features--list">
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img
                                src="/img/home/designed-out-of-the-box.png"
                                alt="Xplorer designed out of the box"
                            />
                            <h2>Desenhado fora da caixa</h2>
                            <p>
                                Diga adeus ao design antigo do app tradicional
                                e diga olá a este design simples, mas poderoso
                                .
                            </p>
                        </div>
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img
                                src="/img/home/support-tabs.png"
                                alt="Support tabs"
                            />
                            <h2>Suporta Múltiplas Abas</h2>
                            <p>
                                Xplorer helps you organize you files easier by
                                suportando várias abas.
                            </p>
                        </div>
                        <div className="col col--4 padding-left--m padding-right--m">
                            <img src="/img/home/preview-files.png" alt="" />
                            <h2>Pré-visualização de arquivo</h2>
                            <p>
                                O Xplorer suporta visualização de arquivos, até vídeos!
                                Saiba mais{' '}
                                <Link to="/docs/guides/operation/#preview-file">
                                    aqui
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
