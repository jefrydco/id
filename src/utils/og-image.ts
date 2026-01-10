import satori from "satori";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { OGImageTemplate } from "@/components/og/OGImageTemplate";

// Cache for fonts and images
let fontCache: { medium: ArrayBuffer; semiBold: ArrayBuffer } | null = null;
let imageCache: { bgImageBase64: string; logoBase64: string } | null = null;

async function loadFonts(): Promise<{
	medium: ArrayBuffer;
	semiBold: ArrayBuffer;
}> {
	if (fontCache) return fontCache;

	const [mediumData, semiBoldData] = await Promise.all([
		fs.readFile(
			path.join(process.cwd(), "public/fonts/inter/Inter_28pt-Medium.ttf"),
		),
		fs.readFile(
			path.join(process.cwd(), "public/fonts/inter/Inter_28pt-SemiBold.ttf"),
		),
	]);

	fontCache = {
		medium: mediumData.buffer.slice(
			mediumData.byteOffset,
			mediumData.byteOffset + mediumData.byteLength,
		),
		semiBold: semiBoldData.buffer.slice(
			semiBoldData.byteOffset,
			semiBoldData.byteOffset + semiBoldData.byteLength,
		),
	};

	return fontCache;
}

async function loadImages(): Promise<{
	bgImageBase64: string;
	logoBase64: string;
}> {
	if (imageCache) return imageCache;

	const [bgImage, logoImage] = await Promise.all([
		fs.readFile(path.join(process.cwd(), "public/og/og-bg.png")),
		fs.readFile(path.join(process.cwd(), "public/jefrydco-id-light.svg")),
	]);

	imageCache = {
		bgImageBase64: `data:image/png;base64,${bgImage.toString("base64")}`,
		logoBase64: `data:image/svg+xml;base64,${logoImage.toString("base64")}`,
	};

	return imageCache;
}

export async function generateOGImage(
	title: string,
	description: string,
	publishedAt: Date,
): Promise<Buffer> {
	const [fonts, images] = await Promise.all([loadFonts(), loadImages()]);

	const element = OGImageTemplate({
		title,
		description,
		publishedAt,
		bgImageBase64: images.bgImageBase64,
		logoBase64: images.logoBase64,
	});

	const svg = await satori(element, {
		width: 1200,
		height: 630,
		fonts: [
			{
				name: "Inter",
				data: fonts.semiBold,
				weight: 600,
				style: "normal",
			},
			{
				name: "Inter",
				data: fonts.medium,
				weight: 500,
				style: "normal",
			},
		],
	});

	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	return png;
}
