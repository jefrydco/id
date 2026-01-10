/// <reference types="astro/client" />
/// <reference types="astro/content" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/pwa-assets" />
/// <reference types="vite-plugin-pwa/info" />

declare module "astro:content" {
	interface Render {
		".md": Promise<{
			Content: import("astro").MarkdownInstance<
				Record<string, unknown>
			>["Content"];
			headings: import("astro").MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, unknown>;
		}>;
	}
}
