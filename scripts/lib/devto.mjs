/** Rewrite root-relative /images/ markdown references to absolute site URLs. */
export function rewriteRelativeImages(markdown, siteUrl) {
  return markdown.replaceAll('](/images/', `](${siteUrl}/images/`);
}

/** Build the dev.to articles API payload for a parsed post. */
export function buildDevtoPayload(post, slug, siteUrl) {
  return {
    article: {
      title: post.data.title,
      body_markdown: rewriteRelativeImages(post.content, siteUrl),
      published: true,
      description: post.data.description,
      canonical_url: `${siteUrl}/blog/${slug}/`,
      tags: (post.data.tags ?? [])
        .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(Boolean)
        .slice(0, 4),
      main_image: post.data.heroImage ? `${siteUrl}${post.data.heroImage}` : undefined,
    },
  };
}

/**
 * Create or update a dev.to article. Returns { id, url }.
 * Pass existingId to update instead of create (idempotent re-publish).
 */
export async function publishToDevto(payload, apiKey, existingId) {
  const url = existingId
    ? `https://dev.to/api/articles/${existingId}`
    : 'https://dev.to/api/articles';
  const res = await fetch(url, {
    method: existingId ? 'PUT' : 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`dev.to ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { id: json.id, url: json.url };
}
