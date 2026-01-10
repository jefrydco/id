// Site info configuration type
export interface SiteInfo {
	website: string;
	title: string;
	author: string;
	description: string;
}

// Theme configuration type
export interface ThemeConfig {
	site: SiteInfo;
}
