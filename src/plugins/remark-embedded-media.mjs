import { visit } from "unist-util-visit";

function normalizeHttpUrl(value) {
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url;
	} catch {
		return null;
	}
}

function escapeHtml(value = "") {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
	return escapeHtml(value);
}

function getHostName(url) {
	return url.hostname.replace(/^www\./, "").toLowerCase();
}

function isYouTubeVideoId(value) {
	return /^[A-Za-z0-9_-]{11}$/.test(value);
}

function isBilibiliVideoId(value) {
	return /^BV[A-Za-z0-9]+$/.test(value);
}

function getSpotifyEmbedUrl(rawUrl) {
	const parsedUrl = normalizeHttpUrl(rawUrl);
	if (!parsedUrl || getHostName(parsedUrl) !== "open.spotify.com") return null;

	const path = parsedUrl.pathname.replace(/^\/embed\//, "/");
	if (
		!/^\/(album|artist|episode|playlist|show|track)\/[A-Za-z0-9]+\/?$/.test(
			path,
		)
	)
		return null;

	const embedUrl = new URL(parsedUrl.toString());
	embedUrl.pathname = `/embed${path}`;
	if (!embedUrl.searchParams.has("utm_source")) {
		embedUrl.searchParams.set("utm_source", "generator");
	}

	return embedUrl;
}

function getYouTubeVideoId(rawId, rawUrl) {
	if (rawId && isYouTubeVideoId(rawId)) return rawId;

	const parsedUrl = normalizeHttpUrl(rawUrl);
	if (!parsedUrl) return "";

	const hostname = getHostName(parsedUrl);
	let videoId = "";

	if (hostname === "youtu.be") {
		videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
	} else if (hostname === "youtube.com") {
		if (parsedUrl.pathname.startsWith("/embed/")) {
			videoId = parsedUrl.pathname.split("/").filter(Boolean)[1] || "";
		} else {
			videoId = parsedUrl.searchParams.get("v") || "";
		}
	}

	return isYouTubeVideoId(videoId) ? videoId : "";
}

function getBilibiliVideoId(rawId, rawUrl) {
	if (rawId && isBilibiliVideoId(rawId)) return rawId;

	const parsedUrl = normalizeHttpUrl(rawUrl);
	if (!parsedUrl || getHostName(parsedUrl) !== "bilibili.com") return "";

	const match = parsedUrl.pathname.match(/\/video\/(BV[A-Za-z0-9]+)/);
	const videoId = match ? match[1] : "";
	return isBilibiliVideoId(videoId) ? videoId : "";
}

function getXPostUrl(rawUrl) {
	const parsedUrl = normalizeHttpUrl(rawUrl);
	if (!parsedUrl) return null;

	const hostname = getHostName(parsedUrl);
	if (hostname !== "x.com" && hostname !== "twitter.com") return null;

	const match = parsedUrl.pathname.match(/^\/[A-Za-z0-9_]{1,15}\/status\/\d+/);
	if (!match) return null;

	parsedUrl.hostname = "twitter.com";
	parsedUrl.pathname = match[0];
	parsedUrl.search = "";
	parsedUrl.hash = "";

	return parsedUrl;
}

function getGitHubRepo(repo) {
	const match = String(repo)
		.trim()
		.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/);
	if (!match) return null;

	return {
		owner: match[1],
		name: match[2],
		repo: `${match[1]}/${match[2]}`,
	};
}

/**
 * A remark plugin that converts custom directives to embedded media HTML elements
 * Supports: link cards, Spotify, YouTube, Bilibili, X posts, and GitHub repository cards
 */
const embedHandlers = {
	link: (node) => {
		const rawUrl = node.attributes?.url ?? "";
		const parsedUrl = normalizeHttpUrl(rawUrl);
		if (!parsedUrl) {
			return false;
		}

		const url = parsedUrl.toString();

		return `
      <div class="link-card-wrapper">
        <a href="${escapeAttribute(url)}" class="link-card" target="_blank" rel="noopener noreferrer" data-url="${escapeAttribute(url)}">
          <div class="link-card-content">
            <div class="link-card-url">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span></span>
            </div>
            <p class="link-card-title" style="display: none;"></p>
            <p class="link-card-description" style="display: none;"></p>
          </div>
          <div class="link-card-image-outer">
            <div class="link-card-image" style="display: none;">
              <img src="" alt="" loading="lazy" />
            </div>
          </div>
        </a>
      </div>
    `;
	},

	spotify: (node) => {
		const embedUrl = getSpotifyEmbedUrl(node.attributes?.url ?? "");
		if (!embedUrl) {
			return false;
		}

		let height = "152";
		if (/\/(album|artist|playlist|show)\//.test(embedUrl.pathname)) {
			height = "352";
		}

		return `
    <figure>
      <iframe
        style="border-radius:12px"
        src="${escapeAttribute(embedUrl.toString())}"
        width="100%"
        height="${height}"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </figure>
    `;
	},

	youtube: (node) => {
		const videoId = getYouTubeVideoId(
			node.attributes?.id ?? "",
			node.attributes?.url ?? "",
		);

		if (!videoId) {
			return false;
		}

		return `
    <figure>
      <iframe
        style="border-radius:6px"
        src="https://www.youtube.com/embed/${escapeAttribute(videoId)}"
        title="YouTube video player"
        loading="lazy"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      ></iframe>
    </figure>
    `;
	},

	bilibili: (node) => {
		const bvid = getBilibiliVideoId(
			node.attributes?.id ?? "",
			node.attributes?.url ?? "",
		);

		if (!bvid) {
			return false;
		}

		return `
    <figure>
      <iframe
        style="border-radius:6px"
        src="https://player.bilibili.com/player.html?isOutside=true&amp;bvid=${escapeAttribute(bvid)}&amp;p=1&amp;autoplay=0&amp;muted=0"
        title="Bilibili video player"
        loading="lazy"
        scrolling="no"
        border="0"
        frameborder="no"
        framespacing="0"
        allow="fullscreen"
      ></iframe>
    </figure>
    `;
	},

	x: (node) => {
		const twitterUrl = getXPostUrl(node.attributes?.url ?? "");
		if (!twitterUrl) {
			return false;
		}

		const uniqueId = `x-card-${Math.random().toString(36).slice(2, 11)}`;

		return `
    <figure class="x-card">
      <blockquote class="twitter-tweet" data-dnt="true" id="${uniqueId}">
        <a href="${escapeAttribute(twitterUrl.toString())}"></a>
      </blockquote>
    </figure>
    `;
	},

	github: (node) => {
		const repoData = getGitHubRepo(node.attributes?.repo ?? "");
		if (!repoData) {
			console.warn(`Missing or invalid GitHub repository`);
			return false;
		}

		const { owner, name, repo } = repoData;

		return `
    <a href="https://github.com/${escapeAttribute(repo)}" class="gc-container" target="_blank" rel="noopener noreferrer" data-repo="${escapeAttribute(repo)}">
        <div class="gc-title-bar">
          <div class="gc-owner-avatar" style="background-size: cover; background-position: center;" aria-hidden="true"></div>
          <span class="gc-repo-title">
            <span>${escapeHtml(owner)}<span class="gc-slash" aria-hidden="true">/</span><strong>${escapeHtml(name)}</strong></span>
          </span>
          <svg class="gc-github-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
            <path d="M9 18c-4.51 2-5-2-7-2"/>
          </svg>
        </div>
        <p class="gc-repo-description">--</p>
        <div class="gc-info-bar">
          <svg class="gc-info-icon" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path>
          </svg>
          <span class="gc-stars-count" aria-label="Stars count">--</span>
          <svg class="gc-info-icon" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path>
          </svg>
          <span class="gc-forks-count" aria-label="Forks count">--</span>
          <svg class="gc-info-icon" height="16" width="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.006.005-.01.01-.045.04c-.21.176-.441.327-.686.45C14.556 10.78 13.88 11 13 11a4.498 4.498 0 0 1-2.023-.454 3.544 3.544 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.004-.004v-.001a.75.75 0 0 1-.154-.838L12.178 4.5h-.162c-.305 0-.604-.079-.868-.231l-1.29-.736a.245.245 0 0 0-.124-.033H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V3.5h-.984a.245.245 0 0 0-.124.033l-1.289.737c-.265.15-.564.23-.869.23h-.162l2.112 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04c-.21.176-.441.327-.686.45C4.556 10.78 3.88 11 3 11a4.498 4.498 0 0 1-2.023-.454 3.544 3.544 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.004-.004v-.001a.75.75 0 0 1-.154-.838L2.178 4.5H1.75a.75.75 0 0 1 0-1.5h2.234a.249.249 0 0 0 .125-.033l1.288-.737c.265-.15.564-.23.869-.23h.984V.75a.75.75 0 0 1 1.5 0Zm2.945 8.477c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L13 6.327Zm-10 0c.285.135.718.273 1.305.273s1.02-.138 1.305-.273L3 6.327Z"></path>
          </svg>
          <span class="gc-license-info" aria-label="License">--</span>
        </div>
      </a>
    `;
	},

	neodb: (node) => {
		const parsedUrl = normalizeHttpUrl(node.attributes?.url ?? "");
		if (!parsedUrl || getHostName(parsedUrl) !== "neodb.social") {
			return false;
		}

		const url = parsedUrl.toString();
		const match = parsedUrl.pathname.match(
			/^\/(movie|book|music|album|game|tv\/season|tv|podcast)\/([\w-]+)/,
		);
		if (!match) return false;

		const category = match[1];
		const isSquare =
			category === "music" || category === "album" || category === "podcast";
		const skeletonClass = isSquare ? "music" : "other";

		return `<div class="neodb-card-container" data-url="${escapeAttribute(url)}">
  <div class="neodb-card neodb-loading ${escapeAttribute(skeletonClass)}">
  </div>
</div>`;
	},

	video: (node) => {
		const rawSrc = node.attributes?.src ?? "";
		if (!rawSrc) {
			return false;
		}

		const isAbsolute = /^https?:\/\//i.test(rawSrc);
		const isRelative = !isAbsolute && !/^[a-z][a-z0-9+.-]*:/i.test(rawSrc);
		let src = "";

		if (isAbsolute) {
			const parsed = normalizeHttpUrl(rawSrc);
			if (!parsed) return false;
			src = parsed.toString();
		} else if (isRelative) {
			src = rawSrc;
		} else {
			return false;
		}

		return `
    <figure class="video-embed-wrapper">
      <div class="video-embed-container" data-video-src="${escapeAttribute(src)}">
        <div class="video-embed-placeholder">
          <button class="video-embed-play" type="button" aria-label="Play video">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </figure>
    `;
	},
};

export default function remarkEmbeddedMedia() {
	return (tree) => {
		visit(
			tree,
			["leafDirective", "containerDirective", "textDirective"],
			(node) => {
				const handler = embedHandlers[node.name];
				if (!handler) {
					return;
				}

				const htmlContent = handler(node);
				if (!htmlContent) {
					return;
				}

				node.type = "html";
				node.value = htmlContent;
				delete node.name;
				delete node.attributes;
				delete node.children;
			},
		);
	};
}
