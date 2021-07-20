import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    Svg: require('../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer was designed to manage your files easily, and you can preview the file natively inside Xplorer!
      </>
    ),
  },
  {
    title: 'Customizable',
    Svg: require('../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer allows you to design your own theme, and you can turn on/off any feature through settings easily!
      </>
    ),
  },
  {
    title: 'Modern',
    Svg: require('../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer was designed to be fully functional and easy to use with a modern looks!.
      </>
    ),
  },
  {
    title: 'Cross Platform',
    Svg: require('../../static/img/octocat.svg').default,
    description: (
      <>
        Being built using Electron technology, you can run Xplorer on Windows, Linux, and macOS! (macOS haven't been tested)
      </>
    )
  },
  {
    title: "It's FOSS (Free And Open Source)",
    Svg: require('../../static/img/octocat.svg').default,
    description: (
      <>
        Xplorer is an open source project which is hosted publicly on GitHub.
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
