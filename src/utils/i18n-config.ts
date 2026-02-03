import type { Locale } from "@/i18n";
import { hasBlogTranslation } from "@/utils/i18n-content";
import { hasNoteTranslation } from "@/utils/i18n-notes";
import { hasTalkTranslation } from "@/utils/i18n-talk-content";

export type ContentType = "blog" | "notes" | "talk";

export interface ContentConfig {
	path: string;
	hasTranslation: (slug: string, locale: Locale) => Promise<boolean>;
}

export const contentConfigs: Record<ContentType, ContentConfig> = {
	notes: {
		path: "/notes/",
		hasTranslation: hasNoteTranslation,
	},
	talk: {
		path: "/talk/",
		hasTranslation: hasTalkTranslation,
	},
	blog: {
		path: "/blog/",
		hasTranslation: hasBlogTranslation,
	},
};

export function detectContentType(currentPath: string): ContentType {
	for (const [type, config] of Object.entries(contentConfigs)) {
		if (currentPath.includes(config.path)) {
			return type as ContentType;
		}
	}
	return "blog";
}
