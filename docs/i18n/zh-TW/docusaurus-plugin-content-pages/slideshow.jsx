import React, { useEffect, useState } from 'react';

const slides = [
	{
		name: 'Windows',
		src: '/img/Xplorer_dark.png',
		alt: 'Xplorer on Windows',
	},
	{
		name: 'Garuda Linux',
		src: '/img/Xplorer%20linux.png',
		alt: 'Xplorer on Linux',
	},
	{
		name: 'macOS Catalina',
		src: '/img/Xplorer%20mac.png',
		alt: 'Xplorer on macOS',
	},
];

export default function Slideshow() {
	const [index, setIndex] = useState(0);
	useEffect(() => {
		const handle = setInterval(() => setIndex((i) => (i + 1) % 3), 2500);
		return () => clearInterval(handle);
	}, []);
	return (
		<>
			<div className="slideshow-container">
				{slides.map((e, i) => (
					<div key={i} className={`slide${index === i ? ' active' : ''}`}>
						<div className="slide-numbertext">
							{i + 1} / {slides.length}
						</div>
						<img src={e.src} alt={e.alt} />
						<div className="slide-caption">{e.name}</div>
					</div>
				))}
			</div>
			<div className="slide-dots">
				{[0, 1, 2].map((e) => (
					<span key={e} className={`slide-dot${index === e ? ' active' : ''}`} />
				))}
			</div>
		</>
	);
}
