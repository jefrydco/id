export interface SvgPrepareOptions {
	inlineStyles?: boolean;
	backgroundColor?: string;
	cssProperties?: string[];
	originalElement?: SVGElement;
}

export interface PngConvertOptions extends SvgPrepareOptions {
	scale?: number;
	useDataUrl?: boolean;
}

const DEFAULT_CSS_PROPERTIES = [
	"fill",
	"stroke",
	"stroke-width",
	"stroke-dasharray",
	"font-family",
	"font-size",
	"font-weight",
	"opacity",
	"color",
];

function inlineComputedStyles(
	originalSvg: SVGElement,
	clonedSvg: SVGElement,
	cssProps: string[],
): void {
	const origElements = originalSvg.querySelectorAll("*");
	const clonedElements = clonedSvg.querySelectorAll("*");

	for (let i = 0; i < origElements.length && i < clonedElements.length; i++) {
		const computed = window.getComputedStyle(origElements[i]);
		const styles: string[] = [];

		for (const prop of cssProps) {
			const value = computed.getPropertyValue(prop);
			if (value && value !== "none" && value !== "normal") {
				styles.push(`${prop}:${value}`);
			}
		}

		if (styles.length) {
			const existing = clonedElements[i].getAttribute("style") || "";
			clonedElements[i].setAttribute(
				"style",
				`${existing};${styles.join(";")}`,
			);
		}
	}
}

function addBackground(svg: SVGElement, color: string): void {
	const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	rect.setAttribute("width", "100%");
	rect.setAttribute("height", "100%");
	rect.setAttribute("fill", color);
	svg.insertBefore(rect, svg.firstChild);
}

export function prepareSvgForExport(
	svgElement: SVGElement,
	options?: SvgPrepareOptions,
): SVGElement {
	const svg = svgElement.cloneNode(true) as SVGElement;
	const bbox = svgElement.getBoundingClientRect();

	svg.setAttribute("width", String(bbox.width));
	svg.setAttribute("height", String(bbox.height));
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

	if (options?.backgroundColor) {
		addBackground(svg, options.backgroundColor);
	}

	if (options?.inlineStyles) {
		const originalEl = options.originalElement || svgElement;
		const cssProps = options.cssProperties || DEFAULT_CSS_PROPERTIES;
		inlineComputedStyles(originalEl, svg, cssProps);
	}

	return svg;
}

export async function svgToBlob(svgElement: SVGElement): Promise<Blob> {
	const svg = svgElement.cloneNode(true) as SVGElement;
	const bbox = svgElement.getBoundingClientRect();
	svg.setAttribute("width", String(bbox.width));
	svg.setAttribute("height", String(bbox.height));
	svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

	const svgString = new XMLSerializer().serializeToString(svg);
	return new Blob([svgString], { type: "image/svg+xml" });
}

export function svgToDataUrl(svg: SVGElement): string {
	const svgString = new XMLSerializer().serializeToString(svg);
	const base64 = btoa(unescape(encodeURIComponent(svgString)));
	return `data:image/svg+xml;base64,${base64}`;
}

export async function svgToPngBlob(
	svgElement: SVGElement,
	options?: PngConvertOptions,
): Promise<Blob> {
	const scale = options?.scale ?? 2;
	const bbox = svgElement.getBoundingClientRect();

	const preparedSvg = prepareSvgForExport(svgElement, {
		...options,
		originalElement: options?.originalElement || svgElement,
	});

	let imgSrc: string;
	if (options?.useDataUrl) {
		imgSrc = svgToDataUrl(preparedSvg);
	} else {
		const svgString = new XMLSerializer().serializeToString(preparedSvg);
		const svgBlob = new Blob([svgString], {
			type: "image/svg+xml;charset=utf-8",
		});
		imgSrc = URL.createObjectURL(svgBlob);
	}

	const img = new Image();
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = reject;
		img.src = imgSrc;
	});

	const canvas = document.createElement("canvas");
	canvas.width = bbox.width * scale;
	canvas.height = bbox.height * scale;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get canvas 2D context");
	}
	ctx.scale(scale, scale);
	ctx.drawImage(img, 0, 0);

	if (!options?.useDataUrl) {
		URL.revokeObjectURL(imgSrc);
	}

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
			} else {
				reject(new Error("Failed to create PNG blob"));
			}
		}, "image/png");
	});
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export async function downloadSvg(
	svgElement: SVGElement,
	filename: string,
	format: "svg" | "png",
	options?: PngConvertOptions,
): Promise<void> {
	if (format === "svg") {
		const preparedSvg = prepareSvgForExport(svgElement, options);
		const svgString = new XMLSerializer().serializeToString(preparedSvg);
		const blob = new Blob([svgString], { type: "image/svg+xml" });
		downloadBlob(blob, `${filename}.svg`);
	} else {
		const pngBlob = await svgToPngBlob(svgElement, options);
		downloadBlob(pngBlob, `${filename}.png`);
	}
}
