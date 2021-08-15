import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: '简单易用',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer 旨在轻松管理您的文件，您甚至可以在 Xplorer 中预览文件！
      </>
    ),
  },
  {
    title: '可客制化',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer 允许您设计自己的主题，您可以通过设置轻松打开/关闭任何功能！
      </>
    ),
  },
  {
    title: '现代化',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer 使用现代化的设计，功能齐全且易于使用！
      </>
    ),
  },
  {
    title: '跨平台',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        使用 Electron 技术构建，您不仅可以在 Windows、Linux 和 macOS 上也可以运行 Xplorer！ （macOS 尚未经过测试）
      </>
    )
  },
  {
    title: "免费开源",
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer 是一个开源项目，在 <a href="https://github.com/kimlimjustin/xplorer">GitHub</a> 上公开托管。
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
