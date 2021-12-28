import React from 'react';
import { useState } from 'react';
import { EmailIcon, ErrorIcon } from '../util/icon';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate from '@docusaurus/Translate';
import { translate } from '@docusaurus/Translate';
import BrowserOnly from '@docusaurus/BrowserOnly';

const Newsletter = () => {
	const [email, setEmail] = useState('');
	const [subscribeError, setSubscribeError] = useState('');
	const [subscribed, setSubscribed] = useState(false);

	return (
		<BrowserOnly fallback={<div>Loading...</div>}>
			{() => {
				const createClient = require('@supabase/supabase-js').createClient;
				const supabaseUrl = 'https://wqjupxjiasadqvqajrqu.supabase.co';
				const supabaseKey = useDocusaurusContext().siteConfig.customFields.supabaseKey;
				const supabase = createClient(supabaseUrl, supabaseKey);
				const SUPABASE_ALREADY_SUBSCRIBED = '23505';

				const Subscribe = async (e) => {
					e.preventDefault();
					const { data, error } = await supabase.from('newsletter').insert([{ email: email }]);
					if (data) setSubscribed(true);
					if (error && error.code === SUPABASE_ALREADY_SUBSCRIBED)
						setSubscribeError(translate({ message: "You've already subcribed to this newsletter!", id: 'newsletter.alreadySubscribed' }));
					if (error && error.code !== SUPABASE_ALREADY_SUBSCRIBED)
						setSubscribeError(translate({ message: 'Something went wrong, please try again later.', id: 'newsletter.error' }));
				};
				return (
					<div className="newsletter margin-vert--lg">
						<div className="row">
							<div className="col col-6">
								<h2 className="newsletter-title">
									<Translate id="subscribe.title">Subscribe to our newsletter</Translate>
								</h2>
								<p className="newsletter-description">
									<Translate id="subscribe.description">
										Join the Xplorer newsletter and stay updated on new releases, new features, etc.
									</Translate>
								</p>
							</div>
							{!subscribed ? (
								<div className="col col-6">
									<form onSubmit={Subscribe}>
										<label htmlFor="email-input-field" className="margin-top--md margin-bottom--lg">
											<EmailIcon />
											<input
												type="email"
												placeholder="Your email"
												id="email-input-field"
												value={email}
												onChange={({ target: { value } }) => setEmail(value)}
											/>
										</label>
										{subscribeError.length > 0 ? (
											<div className="subscribe-error">
												<ErrorIcon />
												<h3 className="subscribe-error--text">{subscribeError}</h3>
											</div>
										) : null}
										<button type="submit" className="btn submit-newsletter-btn">
											<Translate id="newsletter.subscribeBtn">Subscribe</Translate>
										</button>
									</form>
								</div>
							) : (
								<div className="col col-6">
									<h2 className="thanks-for-subscribing--text">
										<Translate id="newsletter.thanks">Thanks for Subscribing!</Translate>
									</h2>
								</div>
							)}
						</div>
					</div>
				);
			}}
		</BrowserOnly>
	);
};
export default Newsletter;
