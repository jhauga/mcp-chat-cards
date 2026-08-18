import {
  escapeHtml,
  isDisplayableImageUrl,
  isHttpUrl,
  isPlayableMediaUrl,
  textToParagraphs,
} from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface VideoCardOptions {
  title: string;
  subtitle?: string;
  // Direct URL to a video file (mp4/webm), a data:video/* URI, or a blob:
  // URL. Streaming platform page URLs will not play inside a <video> tag.
  src: string;
  poster?: string;
  description?: string;
  loop?: boolean;
  muted?: boolean;
  autoplay?: boolean;
  contextActions?: ContextAction[];
}

// A data: source travels inside the tool result itself, so it is capped well
// below the size at which hosts truncate a result rather than render it.
export const MAX_INLINE_MEDIA_CHARS = 1_500_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  ogg: "video/ogg",
  mov: "video/quicktime",
};

// Hosts that serve video only through their own player. A <video> element
// pointed at one of these pages loads an HTML document, so the card renders a
// player that can never play: the failure is silent and looks like a broken
// card rather than a bad argument. Rejecting at the tool boundary is the only
// point where the caller can still be told what to do instead.
const STREAMING_PAGE_HOSTS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "dailymotion.com",
  "dai.ly",
  "twitch.tv",
  "tiktok.com",
  "facebook.com",
  "instagram.com",
];

// Matches the host itself and any subdomain of it, so "www.youtube.com" and
// "m.youtube.com" are caught without matching "notyoutube.com".
export function streamingPageHost(src: string): string | null {
  let host: string;
  try {
    host = new URL(src).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    STREAMING_PAGE_HOSTS.find((known) => host === known || host.endsWith(`.${known}`)) ?? null
  );
}

// The type hint on <source> lets a client skip a format it cannot decode
// instead of downloading it first. An unknown extension yields no hint, which
// is valid - the client then sniffs the response.
function mediaType(src: string): string {
  const data = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)\s*[;,]/i.exec(src);
  if (data) return data[1].toLowerCase();
  if (!isHttpUrl(src)) return "";
  try {
    const path = new URL(src).pathname;
    const dot = path.lastIndexOf(".");
    return dot === -1 ? "" : (MIME_BY_EXTENSION[path.slice(dot + 1).toLowerCase()] ?? "");
  } catch {
    return "";
  }
}

export function buildVideoCard(options: VideoCardOptions): RenderedCard {
  const src = options.src.trim();
  if (!isPlayableMediaUrl(src)) {
    throw new Error(
      "Video src must be an http(s) URL, a data:video/* URI, or a blob: URL, got: " +
        `${src.slice(0, 64)}${src.length > 64 ? "..." : ""}`,
    );
  }
  const streamingHost = streamingPageHost(src);
  if (streamingHost) {
    throw new Error(
      `Video src must point straight at a video file (mp4/webm), but ${streamingHost} serves ` +
        "video only through its own player page, which a <video> element cannot play. Pass a " +
        "direct http(s) URL to the file, a data:video/* URI, or a blob: URL - or call " +
        "create_animation_card to generate an animated clip instead.",
    );
  }
  if (src.startsWith("data:") && src.length > MAX_INLINE_MEDIA_CHARS) {
    throw new Error(
      `Inline video data is ${src.length} characters, over the ${MAX_INLINE_MEDIA_CHARS} character ` +
        "limit for a card payload. Host the clip and pass its http(s) URL instead.",
    );
  }

  const posterSrc = options.poster?.trim();
  const poster =
    posterSrc && isDisplayableImageUrl(posterSrc) ? ` poster="${escapeHtml(posterSrc)}"` : "";
  const loop = options.loop ? " loop" : "";
  // Autoplay is only honoured by clients when the track is muted, so asking
  // for autoplay implies muted rather than silently doing nothing.
  const autoplay = options.autoplay ? " autoplay" : "";
  const muted = options.muted || options.autoplay ? " muted" : "";
  const description = options.description ? textToParagraphs(options.description) : "";
  const type = mediaType(src);
  const typeAttr = type ? ` type="${escapeHtml(type)}"` : "";
  const escapedSrc = escapeHtml(src);

  // The source is given twice on purpose: as the src attribute, which every
  // client honours, and as a <source> child, which survives sanitizers that
  // drop url-bearing attributes but keep elements. Only an http(s) source
  // gets an "open directly" link - repeating a data: URI would double an
  // already large payload.
  const directLink = isHttpUrl(src)
    ? `\n<p class="mcc-video-fallback"><a href="${escapedSrc}" target="_blank" rel="noopener noreferrer">Open the clip directly</a></p>`
    : "";

  const body = `<section class="mcc-block mcc-video">
${description}
<div class="mcc-video-frame">
<video class="mcc-video-player" controls playsinline preload="metadata"${poster}${loop}${muted}${autoplay} src="${escapedSrc}">
<source src="${escapedSrc}"${typeAttr}>
Your chat client cannot play embedded video.
</video>
</div>${directLink}
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "video",
    body,
    contextActions: options.contextActions,
  });
  // Not every direct video URL carries an extension (a signed or generated
  // one often does not), so an unrecognized path is a warning rather than a
  // rejection - the caller sees it in the conversation if the player is blank.
  const unknownType =
    isHttpUrl(src) && !type
      ? " The URL has no recognized video extension, so it may not be a direct video file;" +
        " if the player stays blank, use create_animation_card instead."
      : "";
  return {
    ...doc,
    summary:
      `Created video card "${options.title}" for ${isHttpUrl(src) ? src : "an inline clip"}.` +
      unknownType,
  };
}
