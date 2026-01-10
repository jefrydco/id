/**
 * rehype-mermaid-ssr.mjs
 * Server-side rendering for Mermaid diagrams using Puppeteer
 *
 * Renders mermaid code blocks to SVG at build time with 3 theme variants
 * (light, dark, reading) that are toggled via CSS based on html class.
 */

import puppeteer from "puppeteer";
import { visit } from "unist-util-visit";
import { toText } from "hast-util-to-text";

// Theme configurations from MermaidTheme.astro
const mermaidThemes = {
	light: {
		theme: "base",
		themeVariables: {
			primaryColor: "#f5f5f5",
			primaryTextColor: "rgba(0, 0, 0, 0.85)",
			primaryBorderColor: "rgba(0, 0, 0, 0.15)",
			lineColor: "rgba(0, 0, 0, 0.4)",
			secondaryColor: "#ffffff",
			tertiaryColor: "#fafafa",
			background: "#ffffff",
			mainBkg: "#ffffff",
			secondBkg: "#f5f5f5",
			nodeBorder: "rgba(0, 0, 0, 0.15)",
			clusterBkg: "#f5f5f5",
			clusterBorder: "rgba(0, 0, 0, 0.1)",
			titleColor: "rgba(0, 0, 0, 0.85)",
			edgeLabelBackground: "#ffffff",
			textColor: "rgba(0, 0, 0, 0.85)",
			nodeTextColor: "rgba(0, 0, 0, 0.85)",
			labelTextColor: "rgba(0, 0, 0, 0.85)",
			signalColor: "rgba(0, 0, 0, 0.85)",
			signalTextColor: "rgba(0, 0, 0, 0.85)",
			actorBkg: "#f5f5f5",
			actorBorder: "rgba(0, 0, 0, 0.15)",
			actorTextColor: "rgba(0, 0, 0, 0.85)",
			actorLineColor: "rgba(0, 0, 0, 0.3)",
			labelBoxBkgColor: "#f5f5f5",
			labelBoxBorderColor: "rgba(0, 0, 0, 0.15)",
			noteBkgColor: "#fffde7",
			noteBorderColor: "rgba(0, 0, 0, 0.1)",
			noteTextColor: "rgba(0, 0, 0, 0.85)",
			activationBkgColor: "#e8e8e8",
			activationBorderColor: "rgba(0, 0, 0, 0.2)",
			sequenceNumberColor: "#ffffff",
			sectionBkgColor: "#f5f5f5",
			altSectionBkgColor: "#ffffff",
			sectionBkgColor2: "#f5f5f5",
			taskBkgColor: "#e8e8e8",
			taskBorderColor: "rgba(0, 0, 0, 0.15)",
			taskTextColor: "rgba(0, 0, 0, 0.85)",
			taskTextLightColor: "rgba(0, 0, 0, 0.6)",
			taskTextOutsideColor: "rgba(0, 0, 0, 0.85)",
			activeTaskBkgColor: "#d0d0d0",
			activeTaskBorderColor: "rgba(0, 0, 0, 0.2)",
			gridColor: "rgba(0, 0, 0, 0.1)",
			doneTaskBkgColor: "#c8c8c8",
			doneTaskBorderColor: "rgba(0, 0, 0, 0.15)",
			critBkgColor: "#ffebee",
			critBorderColor: "rgba(200, 50, 50, 0.3)",
			todayLineColor: "rgba(0, 0, 0, 0.5)",
			relationColor: "rgba(0, 0, 0, 0.4)",
			relationLabelColor: "rgba(0, 0, 0, 0.85)",
			relationLabelBackground: "#ffffff",
			classText: "rgba(0, 0, 0, 0.85)",
			fillType0: "#f5f5f5",
			fillType1: "#e8e8e8",
			fillType2: "#d8d8d8",
			fillType3: "#c8c8c8",
			fillType4: "#f0f0f0",
			fillType5: "#e0e0e0",
			fillType6: "#d0d0d0",
			fillType7: "#c0c0c0",
			pie1: "#e0e0e0",
			pie2: "#c8c8c8",
			pie3: "#b0b0b0",
			pie4: "#989898",
			pie5: "#808080",
			pie6: "#686868",
			pie7: "#505050",
			pie8: "#383838",
			pie9: "#202020",
			pie10: "#101010",
			pie11: "#000000",
			pie12: "#1a1a1a",
			pieTitleTextSize: "16px",
			pieTitleTextColor: "rgba(0, 0, 0, 0.85)",
			pieSectionTextSize: "14px",
			pieSectionTextColor: "rgba(0, 0, 0, 0.85)",
			pieLegendTextSize: "14px",
			pieLegendTextColor: "rgba(0, 0, 0, 0.85)",
			pieStrokeColor: "rgba(0, 0, 0, 0.1)",
			pieStrokeWidth: "1px",
			git0: "#e8e8e8",
			git1: "#d0d0d0",
			git2: "#b8b8b8",
			git3: "#a0a0a0",
			git4: "#888888",
			git5: "#707070",
			git6: "#585858",
			git7: "#404040",
			gitBranchLabel0: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel1: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel2: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel3: "#ffffff",
			gitBranchLabel4: "#ffffff",
			gitBranchLabel5: "#ffffff",
			gitBranchLabel6: "#ffffff",
			gitBranchLabel7: "#ffffff",
			commitLabelColor: "rgba(0, 0, 0, 0.85)",
			commitLabelBackground: "#f5f5f5",
			commitLabelFontSize: "12px",
			tagLabelColor: "rgba(0, 0, 0, 0.85)",
			tagLabelBackground: "#e8e8e8",
			tagLabelBorder: "rgba(0, 0, 0, 0.15)",
			tagLabelFontSize: "12px",
		},
	},
	dark: {
		theme: "base",
		themeCSS: `
.row-rect-odd path { fill: #404040 !important; }
.row-rect-even path { fill: #353535 !important; }
.nodeLabel { color: rgba(255, 255, 255, 0.95) !important; }
.nodeLabel p { color: rgba(255, 255, 255, 0.95) !important; }
`,
		themeVariables: {
			primaryColor: "#404040",
			primaryTextColor: "rgba(255, 255, 255, 0.95)",
			primaryBorderColor: "rgba(255, 255, 255, 0.35)",
			lineColor: "rgba(255, 255, 255, 0.6)",
			secondaryColor: "#353535",
			tertiaryColor: "#404040",
			background: "#1c1c1c",
			mainBkg: "#353535",
			secondBkg: "#404040",
			nodeBorder: "rgba(255, 255, 255, 0.35)",
			clusterBkg: "#2a2a2a",
			clusterBorder: "rgba(255, 255, 255, 0.25)",
			titleColor: "rgba(255, 255, 255, 0.95)",
			edgeLabelBackground: "#2a2a2a",
			textColor: "rgba(255, 255, 255, 0.95)",
			nodeTextColor: "rgba(255, 255, 255, 0.95)",
			labelTextColor: "rgba(255, 255, 255, 0.95)",
			attributeBackgroundColorOdd: "#404040",
			attributeBackgroundColorEven: "#353535",
			entityBorder: "rgba(255, 255, 255, 0.35)",
			entityBackground: "#2a2a2a",
			entityTextColor: "rgba(255, 255, 255, 0.95)",
			signalColor: "rgba(255, 255, 255, 0.95)",
			signalTextColor: "rgba(255, 255, 255, 0.95)",
			actorBkg: "#404040",
			actorBorder: "rgba(255, 255, 255, 0.35)",
			actorTextColor: "rgba(255, 255, 255, 0.95)",
			actorLineColor: "rgba(255, 255, 255, 0.5)",
			labelBoxBkgColor: "#404040",
			labelBoxBorderColor: "rgba(255, 255, 255, 0.35)",
			noteBkgColor: "#4a4a3a",
			noteBorderColor: "rgba(255, 255, 255, 0.25)",
			noteTextColor: "rgba(255, 255, 255, 0.95)",
			activationBkgColor: "#505050",
			activationBorderColor: "rgba(255, 255, 255, 0.4)",
			sequenceNumberColor: "#1c1c1c",
			sectionBkgColor: "#353535",
			altSectionBkgColor: "#2a2a2a",
			sectionBkgColor2: "#404040",
			taskBkgColor: "#4a4a4a",
			taskBorderColor: "rgba(255, 255, 255, 0.35)",
			taskTextColor: "rgba(255, 255, 255, 0.95)",
			taskTextLightColor: "rgba(255, 255, 255, 0.7)",
			taskTextOutsideColor: "rgba(255, 255, 255, 0.95)",
			activeTaskBkgColor: "#5a5a5a",
			activeTaskBorderColor: "rgba(255, 255, 255, 0.4)",
			gridColor: "rgba(255, 255, 255, 0.2)",
			doneTaskBkgColor: "#5a5a5a",
			doneTaskBorderColor: "rgba(255, 255, 255, 0.35)",
			critBkgColor: "#5a3a3a",
			critBorderColor: "rgba(255, 100, 100, 0.5)",
			todayLineColor: "rgba(255, 255, 255, 0.7)",
			relationColor: "rgba(255, 255, 255, 0.6)",
			relationLabelColor: "rgba(255, 255, 255, 0.95)",
			relationLabelBackground: "#2a2a2a",
			classText: "rgba(255, 255, 255, 0.95)",
			fillType0: "#404040",
			fillType1: "#4a4a4a",
			fillType2: "#555555",
			fillType3: "#606060",
			fillType4: "#454545",
			fillType5: "#505050",
			fillType6: "#5a5a5a",
			fillType7: "#656565",
			pie1: "#4a4a4a",
			pie2: "#5a5a5a",
			pie3: "#6a6a6a",
			pie4: "#7a7a7a",
			pie5: "#8a8a8a",
			pie6: "#9a9a9a",
			pie7: "#aaaaaa",
			pie8: "#bababa",
			pie9: "#cacaca",
			pie10: "#dadada",
			pie11: "#eaeaea",
			pie12: "#f5f5f5",
			pieTitleTextSize: "16px",
			pieTitleTextColor: "rgba(255, 255, 255, 0.95)",
			pieSectionTextSize: "14px",
			pieSectionTextColor: "rgba(0, 0, 0, 0.85)",
			pieLegendTextSize: "14px",
			pieLegendTextColor: "rgba(255, 255, 255, 0.95)",
			pieStrokeColor: "rgba(255, 255, 255, 0.25)",
			pieStrokeWidth: "2px",
			git0: "#4a4a4a",
			git1: "#5a5a5a",
			git2: "#6a6a6a",
			git3: "#7a7a7a",
			git4: "#8a8a8a",
			git5: "#9a9a9a",
			git6: "#aaaaaa",
			git7: "#bababa",
			gitBranchLabel0: "rgba(255, 255, 255, 0.95)",
			gitBranchLabel1: "rgba(255, 255, 255, 0.95)",
			gitBranchLabel2: "rgba(255, 255, 255, 0.95)",
			gitBranchLabel3: "rgba(255, 255, 255, 0.95)",
			gitBranchLabel4: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel5: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel6: "rgba(0, 0, 0, 0.85)",
			gitBranchLabel7: "rgba(0, 0, 0, 0.85)",
			commitLabelColor: "rgba(255, 255, 255, 0.95)",
			commitLabelBackground: "#404040",
			commitLabelFontSize: "12px",
			tagLabelColor: "rgba(255, 255, 255, 0.95)",
			tagLabelBackground: "#4a4a4a",
			tagLabelBorder: "rgba(255, 255, 255, 0.35)",
			tagLabelFontSize: "12px",
		},
	},
	reading: {
		theme: "base",
		themeVariables: {
			primaryColor: "#e8dcc8",
			primaryTextColor: "rgba(62, 42, 26, 0.9)",
			primaryBorderColor: "rgba(62, 42, 26, 0.2)",
			lineColor: "rgba(62, 42, 26, 0.4)",
			secondaryColor: "#f4ecd8",
			tertiaryColor: "#e8dcc8",
			background: "#f4ecd8",
			mainBkg: "#f4ecd8",
			secondBkg: "#e8dcc8",
			nodeBorder: "rgba(62, 42, 26, 0.2)",
			clusterBkg: "#e8dcc8",
			clusterBorder: "rgba(62, 42, 26, 0.15)",
			titleColor: "rgba(62, 42, 26, 0.9)",
			edgeLabelBackground: "#f4ecd8",
			textColor: "rgba(62, 42, 26, 0.9)",
			nodeTextColor: "rgba(62, 42, 26, 0.9)",
			labelTextColor: "rgba(62, 42, 26, 0.9)",
			signalColor: "rgba(62, 42, 26, 0.9)",
			signalTextColor: "rgba(62, 42, 26, 0.9)",
			actorBkg: "#e8dcc8",
			actorBorder: "rgba(62, 42, 26, 0.2)",
			actorTextColor: "rgba(62, 42, 26, 0.9)",
			actorLineColor: "rgba(62, 42, 26, 0.3)",
			labelBoxBkgColor: "#e8dcc8",
			labelBoxBorderColor: "rgba(62, 42, 26, 0.2)",
			noteBkgColor: "#f0e8d0",
			noteBorderColor: "rgba(62, 42, 26, 0.15)",
			noteTextColor: "rgba(62, 42, 26, 0.9)",
			activationBkgColor: "#dcd0bc",
			activationBorderColor: "rgba(62, 42, 26, 0.25)",
			sequenceNumberColor: "#f4ecd8",
			sectionBkgColor: "#e8dcc8",
			altSectionBkgColor: "#f4ecd8",
			sectionBkgColor2: "#e8dcc8",
			taskBkgColor: "#dcd0bc",
			taskBorderColor: "rgba(62, 42, 26, 0.2)",
			taskTextColor: "rgba(62, 42, 26, 0.9)",
			taskTextLightColor: "rgba(62, 42, 26, 0.6)",
			taskTextOutsideColor: "rgba(62, 42, 26, 0.9)",
			activeTaskBkgColor: "#d0c4b0",
			activeTaskBorderColor: "rgba(62, 42, 26, 0.25)",
			gridColor: "rgba(62, 42, 26, 0.1)",
			doneTaskBkgColor: "#d0c4b0",
			doneTaskBorderColor: "rgba(62, 42, 26, 0.2)",
			critBkgColor: "#f0d8d0",
			critBorderColor: "rgba(150, 60, 60, 0.3)",
			todayLineColor: "rgba(62, 42, 26, 0.5)",
			relationColor: "rgba(62, 42, 26, 0.4)",
			relationLabelColor: "rgba(62, 42, 26, 0.9)",
			relationLabelBackground: "#f4ecd8",
			classText: "rgba(62, 42, 26, 0.9)",
			fillType0: "#e8dcc8",
			fillType1: "#dcd0bc",
			fillType2: "#d0c4b0",
			fillType3: "#c4b8a4",
			fillType4: "#ece0cc",
			fillType5: "#e0d4c0",
			fillType6: "#d4c8b4",
			fillType7: "#c8bca8",
			pie1: "#dcd0bc",
			pie2: "#d0c4b0",
			pie3: "#c4b8a4",
			pie4: "#b8ac98",
			pie5: "#aca08c",
			pie6: "#a09480",
			pie7: "#948874",
			pie8: "#887c68",
			pie9: "#7c705c",
			pie10: "#706450",
			pie11: "#645844",
			pie12: "#584c38",
			pieTitleTextSize: "16px",
			pieTitleTextColor: "rgba(62, 42, 26, 0.9)",
			pieSectionTextSize: "14px",
			pieSectionTextColor: "rgba(62, 42, 26, 0.9)",
			pieLegendTextSize: "14px",
			pieLegendTextColor: "rgba(62, 42, 26, 0.9)",
			pieStrokeColor: "rgba(62, 42, 26, 0.15)",
			pieStrokeWidth: "1px",
			git0: "#dcd0bc",
			git1: "#d0c4b0",
			git2: "#c4b8a4",
			git3: "#b8ac98",
			git4: "#aca08c",
			git5: "#a09480",
			git6: "#948874",
			git7: "#887c68",
			gitBranchLabel0: "rgba(62, 42, 26, 0.9)",
			gitBranchLabel1: "rgba(62, 42, 26, 0.9)",
			gitBranchLabel2: "rgba(62, 42, 26, 0.9)",
			gitBranchLabel3: "rgba(62, 42, 26, 0.9)",
			gitBranchLabel4: "#f4ecd8",
			gitBranchLabel5: "#f4ecd8",
			gitBranchLabel6: "#f4ecd8",
			gitBranchLabel7: "#f4ecd8",
			commitLabelColor: "rgba(62, 42, 26, 0.9)",
			commitLabelBackground: "#e8dcc8",
			commitLabelFontSize: "12px",
			tagLabelColor: "rgba(62, 42, 26, 0.9)",
			tagLabelBackground: "#dcd0bc",
			tagLabelBorder: "rgba(62, 42, 26, 0.2)",
			tagLabelFontSize: "12px",
		},
	},
};

let browser = null;

async function getBrowser() {
	if (!browser) {
		browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
	}
	return browser;
}

/**
 * Render a mermaid diagram to SVG
 */
async function renderMermaid(code, themeConfig) {
	const browserInstance = await getBrowser();
	const page = await browserInstance.newPage();

	try {
		// Create minimal HTML page
		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
			</head>
			<body>
				<div id="container"></div>
			</body>
			</html>
		`;

		await page.setContent(html);

		// Add mermaid script from node_modules
		await page.addScriptTag({
			path: new URL(
				"../../node_modules/mermaid/dist/mermaid.min.js",
				import.meta.url,
			).pathname,
		});

		// Initialize mermaid and render
		const svg = await page.evaluate(
			async (diagramCode, config) => {
				// Wait for mermaid to be available
				if (typeof mermaid === "undefined") {
					throw new Error("Mermaid not loaded");
				}

				mermaid.initialize({
					startOnLoad: false,
					theme: config.theme,
					themeVariables: config.themeVariables,
					themeCSS: config.themeCSS,
					securityLevel: "loose",
				});

				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
				const { svg } = await mermaid.render(id, diagramCode);
				return svg;
			},
			code,
			themeConfig,
		);

		return svg;
	} finally {
		await page.close();
	}
}

/**
 * Detect diagram type from mermaid code
 */
function detectDiagramType(code) {
	const firstLine = code.trim().split("\n")[0].toLowerCase();
	if (firstLine.includes("flowchart") || firstLine.includes("graph"))
		return "flowchart";
	if (firstLine.includes("sequencediagram") || firstLine.includes("sequence"))
		return "sequence";
	if (firstLine.includes("classdiagram") || firstLine.includes("class"))
		return "class";
	if (firstLine.includes("statediagram") || firstLine.includes("state"))
		return "state";
	if (firstLine.includes("erdiagram") || firstLine.includes("er"))
		return "entity-relationship";
	if (firstLine.includes("gantt")) return "gantt";
	if (firstLine.includes("pie")) return "pie";
	if (firstLine.includes("gitgraph") || firstLine.includes("git"))
		return "git-graph";
	if (firstLine.includes("journey")) return "journey";
	if (firstLine.includes("mindmap")) return "mindmap";
	if (firstLine.includes("timeline")) return "timeline";
	return "diagram";
}

/**
 * Logging utility (matches Astro's log format with cyan color)
 */
function log(message) {
	const prefix = "\x1b[36m[mermaid]\x1b[0m";
	console.log(`${prefix} ${message}`);
}

/**
 * Create themed container HAST node
 */
function createThemedContainer(lightSvg, darkSvg, readingSvg) {
	return {
		type: "element",
		tagName: "div",
		properties: {
			className: ["mermaid-ssr", "download-mermaid-wrapper"],
		},
		children: [
			{
				type: "element",
				tagName: "button",
				properties: {
					className: ["download-button", "mermaid-download"],
					type: "button",
					title: "Download diagram as image",
					"aria-label": "Download diagram as image",
				},
				children: [],
			},
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["mermaid-light"],
				},
				children: [{ type: "raw", value: lightSvg }],
			},
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["mermaid-dark"],
				},
				children: [{ type: "raw", value: darkSvg }],
			},
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["mermaid-reading"],
				},
				children: [{ type: "raw", value: readingSvg }],
			},
		],
	};
}

/**
 * rehype plugin for Mermaid SSR
 */
export default function rehypeMermaidSSR() {
	return async (tree, file) => {
		const mermaidNodes = [];
		const filename =
			file?.history?.[0]?.replace(`${process.cwd()}/`, "") || "unknown";

		// Collect all mermaid code blocks
		// Mermaid blocks are: <pre><code class="language-mermaid">...</code></pre>
		visit(tree, "element", (node, index, parent) => {
			if (
				node.tagName === "pre" &&
				node.children?.[0]?.tagName === "code" &&
				node.children[0].properties?.className?.includes("language-mermaid")
			) {
				mermaidNodes.push({ node, index, parent });
			}
		});

		if (mermaidNodes.length === 0) return;

		log(`Processing ${mermaidNodes.length} diagram(s) in ${filename}`);

		// Render each diagram in 3 themes
		for (let i = 0; i < mermaidNodes.length; i++) {
			const { node, index, parent } = mermaidNodes[i];

			// Extract diagram code from <code> element
			const codeElement = node.children[0];
			const code = toText(codeElement, { whitespace: "pre" });
			const diagramType = detectDiagramType(code);

			log(
				`  [${i + 1}/${mermaidNodes.length}] Rendering ${diagramType} diagram...`,
			);

			try {
				const [lightSvg, darkSvg, readingSvg] = await Promise.all([
					renderMermaid(code, mermaidThemes.light),
					renderMermaid(code, mermaidThemes.dark),
					renderMermaid(code, mermaidThemes.reading),
				]);

				log(`  [${i + 1}/${mermaidNodes.length}] ✓ Generated 3 themed SVGs`);

				// Replace the <pre> block with themed container
				parent.children[index] = createThemedContainer(
					lightSvg,
					darkSvg,
					readingSvg,
				);
			} catch (error) {
				log(`  [${i + 1}/${mermaidNodes.length}] ✗ Error: ${error.message}`);
				// Keep original code block on error
			}
		}

		log(`Completed ${mermaidNodes.length} diagram(s) in ${filename}`);
	};
}
