/**
 * Extract YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=ID, youtube.com/embed/ID, youtu.be/ID
 */
export function getYoutubeId(url: string): string | null {
	const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([\w-]{11})/);
	return match ? match[1] : null;
}
