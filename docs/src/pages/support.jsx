import React from 'react';
import Translate from '@docusaurus/Translate';
import { useState } from 'react';
import Link from '@docusaurus/Link';
import { useEffect } from 'react';

const CONTRIBUTORS_API = 'https://api.github.com/repos/kimlimjustin/xplorer/contributors';

const Support = () => {
	const [contributors, setContributors] = useState([]);
	useEffect(() => {
		fetch(CONTRIBUTORS_API)
			.then((response) => response.json())
			.then((data) => setContributors(data));
	}, []);

	return (
		<div className="supports margin-vert--xl">
			<h1 className="supports-title">
				<Translate id="supports.titlePart1">Designed and developed by</Translate>{' '}
				<em>
					<Translate id="supports.titlePart2">many amazing people.</Translate>
				</em>
			</h1>
			<p className="supports-description">
				<Translate id="supports.descriptionPart1">Xplorer is an Open Source project that</Translate>{' '}
				<Link to="/docs/Community/Contributing/">
					<Translate id="supports.descriptionPart2">everyone can contribute to.</Translate>
				</Link>
			</p>
			<div className="supports-contributors">
				{contributors.slice(0, 50).map(
					(contributor) =>
						contributor.login !== "dependabot[bot]" && (
							<Link to={contributor.html_url} key={contributor.id}>
								<div className="supports-contributor">
									<img
										className="supports-contributor-image"
										src={contributor.avatar_url}
										alt={`${contributor.login} has contributed ${contributor.contributions} times to Xplorer`}
									/>
									<div className="supports-contributor-info">
										<span className="supports-contributor-name">{contributor.login}</span>
										<span className="supports-contributor-count">{contributor.contributions} contributions</span>
									</div>
								</div>
							</Link>
						)
				)}
			</div>
		</div>
	);
};
export default Support;
