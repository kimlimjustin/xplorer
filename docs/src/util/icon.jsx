import React from 'react';
export function Check() {
	return (
		<svg viewBox="0 0 24 24">
			<path
				d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10s10-4.5 10-10S17.5 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4l8-8l-1.41-1.42z"
				fill="currentColor"
			></path>
		</svg>
	);
}

export const EmailIcon = () => {
	return (
		<svg width="1em" height="1em" viewBox="0 0 24 24" className="email-icon">
			<path d="M20 8l-8 5l-8-5V6l8 5l8-5m0-2H4c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" fill="currentColor"></path>
		</svg>
	);
};

export const ErrorIcon = () => {
	return (
		<svg viewBox="0 0 24 24">
			<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"></path>
		</svg>
	);
};
