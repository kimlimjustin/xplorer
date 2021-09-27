import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Mudah dipakai',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer di-desain untuk mengatur file anda dengan mudah, bahkan anda dapat langsung me-<i>preview</i> didalam Xplorer!
      </>
    ),
  },
  {
    title: 'Dapat dipersonafikasi',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Anda dapat men-desain tema Xplorer anda sendiri, dan/atau menyalakan/menutup fitur apapun dengan mudah!
      </>
    ),
  },
  {
    title: 'Modern',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer di-desain untuk bekerja secara penuh dan mudah dipakai dengan penampilan yang modern.
      </>
    ),
  },
  {
    title: 'Cross Platform',
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Dibangun dengan teknologi Electron, anda dapat menjalankannya di Windows, Linux dan macOS! (macOS belum di test)
      </>
    )
  },
  {
    title: "It's FOSS (Free And Open Source) (GRATIS)!",
    Svg: require('../../../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer adalah project <i>open-source</i> yang di-<i>host</i> secara publik di <a href="https://github.com/kimlimjustin/xplorer">GitHub</a>
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
