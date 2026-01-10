import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import pagefind from "astro-pagefind";
import playformInline from "@playform/inline";
import rehypeMermaidSSR from "./src/plugins/rehype-mermaid-ssr.mjs";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import rehypeMathJax4 from "./src/plugins/rehype-mathjax4.mjs";
import rehypeExternalLinks from "rehype-external-links";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkSmartypants from "remark-smartypants";
import {
	transformerNotationHighlight,
	transformerNotationFocus,
	transformerNotationDiff,
	transformerMetaHighlight,
} from "@shikijs/transformers";
import { transformerTwoslash, rendererRich } from "@shikijs/twoslash";
import remarkEmbeddedMedia from "./src/plugins/remark-embedded-media.mjs";
import remarkReadingTime from "./src/plugins/remark-reading-time.mjs";
import rehypeCleanup from "./src/plugins/rehype-cleanup.mjs";
import rehypeImageProcessor from "./src/plugins/rehype-image-processor.mjs";
import rehypeCopyCode from "./src/plugins/rehype-copy-code.mjs";
import rehypeMathDownload from "./src/plugins/rehype-math-download.mjs";
import rehypeZoomMarker from "./src/plugins/rehype-zoom-marker.mjs";
import remarkTOC from "./src/plugins/remark-toc.mjs";
import { themeConfig } from "./src/config";
import { imageConfig } from "./src/utils/image-config";
import path from "node:path";

import cloudflare from "@astrojs/cloudflare";
import sentry from "@sentry/astro";
import AstroPWA from "@vite-pwa/astro";

export default defineConfig({
	site: themeConfig.site.website,
	adapter: cloudflare({
		imageService: "compile",
		routes: {
			extend: {
				exclude: [
					{ pattern: "/sitemap-index.xml" },
					{ pattern: "/sitemap-0.xml" },
				],
			},
		},
	}),
	prefetch: true,
	experimental: {
		svgo: true,
	},
	image: {
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: imageConfig,
		},
	},
	i18n: {
		locales: ["en", "id"],
		defaultLocale: "en",
		routing: {
			prefixDefaultLocale: false,
		},
	},
	markdown: {
		syntaxHighlight: {
			type: "shiki",
			excludeLangs: ["mermaid"],
		},
		shikiConfig: {
			theme: "css-variables",
			wrap: false,
			transformers: [
				transformerNotationHighlight(),
				transformerNotationFocus(),
				transformerNotationDiff(),
				transformerMetaHighlight(),
				transformerTwoslash({
					explicitTrigger: true,
					renderer: rendererRich(),
				}),
			],
		},
		remarkPlugins: [
			remarkMath,
			remarkDirective,
			remarkEmbeddedMedia,
			remarkReadingTime,
			remarkTOC,
			remarkSmartypants,
		],
		rehypePlugins: [
			rehypeMermaidSSR,
			[
				rehypeMathJax4,
				{
					svg: {
						fontCache: "local",
						scale: 1,
					},
					tex: {},
				},
			],
			rehypeMathDownload,
			rehypeZoomMarker,
			rehypeCleanup,
			rehypeImageProcessor,
			rehypeCopyCode,
			[
				rehypeAutolinkHeadings,
				{
					behavior: "append",
					properties: {
						className: ["heading-anchor"],
						ariaLabel: "Link to this section",
					},
					content: {
						type: "element",
						tagName: "span",
						properties: {
							className: ["heading-anchor-icon"],
							ariaHidden: "true",
						},
						children: [{ type: "text", value: "#" }],
					},
				},
			],
			[
				rehypeExternalLinks,
				{
					target: "_blank",
					rel: ["noopener", "noreferrer"],
					content: {
						type: "element",
						tagName: "svg",
						properties: {
							xmlns: "http://www.w3.org/2000/svg",
							viewBox: "0 0 16 16",
							width: "16",
							height: "16",
							fill: "currentColor",
							class: "external-link-icon",
							"aria-hidden": "true",
						},
						children: [
							{
								type: "element",
								tagName: "path",
								properties: {
									d: "M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z",
								},
								children: [],
							},
						],
					},
				},
			],
		],
	},
	integrations: [
		playformInline(),
		mdx(),
		sitemap(),
		pagefind(),
		sentry({
			sourceMapsUploadOptions: {
				project: "jefrydco-id",
				org: "jefrydco",
				authToken: process.env.SENTRY_AUTH_TOKEN,
			},
		}),
		AstroPWA({
			registerType: "autoUpdate",
			pwaAssets: {
				config: true,
			},
			manifest: {
				name: "Jefrydco Blog",
				short_name: "Jefrydco",
				description: "Personal blog by Jefry Dewangga",
				theme_color: "#ffffff",
				background_color: "#ffffff",
				display: "standalone",
				start_url: "/",
				scope: "/",
			},
			workbox: {
				navigateFallback: "/",
				globPatterns: ["**/*.{css,js,html,svg,png,ico,txt,woff2}"],
				globIgnores: ["_worker.js/**/*"],
			},
			experimental: {
				directoryAndTrailingSlashHandler: true,
			},
			devOptions: { enabled: false },
		}),
	],
	vite: {
		resolve: {
			alias: {
				"@": path.resolve("./src"),
			},
		},
		ssr: {
			external: [
				"node:fs/promises",
				"node:path",
				"node:path/posix",
				"node:url",
				"node:crypto",
				"stream",
				"string_decoder",
				"@mathjax/src",
				"puppeteer",
				"workbox-window",
			],
		},
	},
	devToolbar: {
		enabled: false,
	},
});
