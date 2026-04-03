import React, { useRef, useEffect } from "react";
import "./EyeTracker.css";

const PUPIL_RADIUS = 8; // max movement in px

function getPupilOffset(pupilCenter, mouse, maxRadius) {
	const dx = mouse.x - pupilCenter.x;
	const dy = mouse.y - pupilCenter.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	if (dist <= maxRadius) return { x: dx, y: dy };
	const angle = Math.atan2(dy, dx);
	return {
		x: Math.cos(angle) * maxRadius,
		y: Math.sin(angle) * maxRadius,
	};
}

export default function EyeTracker() {
	const containerRef = useRef(null);
	const leftPupilRef = useRef(null);
	const rightPupilRef = useRef(null);

	useEffect(() => {
		function handleMouseMove(e) {
			const container = containerRef.current;
			if (!container) return;
			const rect = container.getBoundingClientRect();

			// Pupil centers relative to viewport
			const leftCenter = {
				x: rect.left + 70 + 7,
				y: rect.top + 38 + 7,
			};
			const rightCenter = {
				x: rect.left + 140 + 7,
				y: rect.top + 38 + 7,
			};
			const mouse = { x: e.clientX, y: e.clientY };

			const leftOffset = getPupilOffset(leftCenter, mouse, PUPIL_RADIUS);
			const rightOffset = getPupilOffset(rightCenter, mouse, PUPIL_RADIUS);

			leftPupilRef.current.style.transform = `translate(${leftOffset.x}px, ${leftOffset.y}px)`;
			rightPupilRef.current.style.transform = `translate(${rightOffset.x}px, ${rightOffset.y}px)`;
		}

		function resetPupils() {
			if (leftPupilRef.current) leftPupilRef.current.style.transform = "translate(0px,0px)";
			if (rightPupilRef.current) rightPupilRef.current.style.transform = "translate(0px,0px)";
		}

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseleave", resetPupils);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseleave", resetPupils);
		};
	}, []);

	return (
		<div className="eye-tracker-container" ref={containerRef}>
			<div className="pupil left-pupil" ref={leftPupilRef}></div>
			<div className="pupil right-pupil" ref={rightPupilRef}></div>
		</div>
	);
}

// The entire EyeTracker.jsx file is being removed.
