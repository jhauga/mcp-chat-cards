import { escapeHtml, isHttpUrl, textToParagraphs } from "../util/html.js";
import { renderCardDocument, type ContextAction, type RenderedCard } from "./shell.js";

export interface VideoCardOptions {
  title: string;
  subtitle?: string;
  // Direct URL to a video file (mp4/webm). Streaming platform page URLs
  // will not play inside a <video> tag.
  src: string;
  poster?: string;
  description?: string;
  loop?: boolean;
  muted?: boolean;
  contextActions?: ContextAction[];
}

export function buildVideoCard(options: VideoCardOptions): RenderedCard {
  if (!isHttpUrl(options.src)) {
    throw new Error(`Video src must be an http(s) URL, got: ${options.src}`);
  }
  const poster = options.poster && isHttpUrl(options.poster) ? ` poster="${escapeHtml(options.poster)}"` : "";
  const loop = options.loop ? " loop" : "";
  const muted = options.muted ? " muted" : "";
  const description = options.description ? textToParagraphs(options.description) : "";

  const body = `<section class="mcc-block mcc-video">
${description}
<video controls preload="metadata"${poster}${loop}${muted} src="${escapeHtml(options.src)}">
Your chat client cannot play embedded video. <a href="${escapeHtml(options.src)}" target="_blank" rel="noopener noreferrer">Open the clip directly</a>.
</video>
</section>`;

  const doc = renderCardDocument({
    title: options.title,
    subtitle: options.subtitle,
    kind: "video",
    body,
    contextActions: options.contextActions,
  });
  return {
    ...doc,
    summary: `Created video card "${options.title}" for ${options.src}.`,
  };
}
