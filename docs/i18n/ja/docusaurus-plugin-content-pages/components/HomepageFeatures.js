import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: '使いやすい',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorerはファイルを簡単に管理できるように設計されており、Xplorer内部でファイルを直接にプレビューできます。
      </>
    ),
  },
  {
    title: 'カスタマイズ可能',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        独自のテーマをデザインでき、設定を通じて任意の機能を簡単にオン/オフできます。
      </>
    ),
  },
  {
    title: 'モダン',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorerは、完全に機能し、モダンな外観で使いやすいように設計されています。
      </>
    ),
  },
  {
    title: 'クロスプラットフォーム',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer は　Electron　を使用してクロスプラットフォーム開発されたので、Xplorer を Windows だけでなく、Linux と macOS　でも同様に実行できますが、macOSではまだテストしていません (macOSメンテナーが必要です)。
      </>
    )
  },
  {
    title: "FOSS（フリー、オープンソース）",
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer は、<a href="https://github.com/kimlimjustin/xplorer">GitHub</a> で公開されているオープンソースプロジェクトです。
      </>
    )
  }
];

function Feature({ Svg, title, description, idx }) {
  return (
    <div className={idx < 3 ? clsx('col col--4') : clsx('col col--6')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => {
            props.idx = idx
            return <Feature key={idx} {...props} />
          })}
        </div>
      </div>
    </section>
  );
}
