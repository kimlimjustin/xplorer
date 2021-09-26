import React, { useEffect } from 'react';
export default function Slideshow() {
	useEffect(() => {
		var slideIndex = 0;

		const showSlides = () => {
			var i;
			var slides = document.getElementsByClassName('slide');
			var dots = document.getElementsByClassName('slide-dot');
			for (i = 0; i < slides.length; i++) {
				slides[i].style.display = 'none';
			}
			slideIndex++;
			if (slideIndex > slides.length) {
				slideIndex = 1;
			}
			for (i = 0; i < dots.length; i++) {
				dots[i].className = dots[i].className.replace(
					' slide-active',
					''
				);
			}
			slides[slideIndex - 1].style.display = 'block';
			dots[slideIndex - 1].className += ' slide-active';
			setTimeout(showSlides, 2000);
		};
		showSlides();
	}, []);
	return (
		<>
			<div className="slideshow-container">
				<div className="slide">
					<div className="slide-numbertext">1 / 3</div>
					<img
						src="/img/Xplorer%20win.png"
						alt="Xplorer on Windows"
					/>
					<div className="slide-caption">Windows</div>
				</div>
				<div className="slide">
					<div className="slide-numbertext">2 / 3</div>
					<img
						src="/img/Xplorer%20linux.png"
						alt="Xplorer on Linux"
					/>
					<div className="slide-caption">Garuda Linux</div>
				</div>
				<div className="slide">
					<div className="slide-numbertext">3 / 3</div>
					<img src="/img/Xplorer%20mac.png" alt="Xplorer on macOS" />
					<div className="slide-caption">macOS Catalina</div>
				</div>
			</div>
			<div className="slide-dots">
				<span className="slide-dot"></span>
				<span className="slide-dot"></span>
				<span className="slide-dot"></span>
			</div>
		</>
	);
}
