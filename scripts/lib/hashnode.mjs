import { rewriteRelativeImages } from './devto.mjs';

/**
 * Build variables for Hashnode's publishPost (create) or updatePost (when
 * existingId is given) GraphQL mutations.
 *
 * NOTE: As of 2026-05-13 Hashnode's GraphQL API (read + publish) requires a
 * Pro plan. Without HASHNODE_TOKEN the pipeline skips this platform; free-tier
 * cross-posting goes through the Chrome-assisted flow instead.
 */
export function buildHashnodePayload(post, slug, siteUrl, publicationId, existingId) {
  const input = {
    title: post.data.title,
    contentMarkdown: rewriteRelativeImages(post.content, siteUrl),
    tags: (post.data.tags ?? [])
      .map((t) => ({
        slug: t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: t,
      }))
      .filter((t, i, arr) => arr.findIndex((x) => x.slug === t.slug) === i),
  };
  if (post.data.heroImage) {
    input.coverImageOptions = { coverImageURL: `${siteUrl}${post.data.heroImage}` };
  }
  if (existingId) {
    input.id = existingId;
  } else {
    input.publicationId = publicationId;
    input.originalArticleURL = `${siteUrl}/blog/${slug}/`;
  }
  return { input };
}

const PUBLISH_MUTATION = `
mutation PublishPost($input: PublishPostInput!) {
  publishPost(input: $input) { post { id url } }
}`;

const UPDATE_MUTATION = `
mutation UpdatePost($input: UpdatePostInput!) {
  updatePost(input: $input) { post { id url } }
}`;

/** Create or update a Hashnode post. Returns { id, url }. */
export async function publishToHashnode(payload, token, isUpdate) {
  const res = await fetch('https://gql.hashnode.com/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: token },
    body: JSON.stringify({
      query: isUpdate ? UPDATE_MUTATION : PUBLISH_MUTATION,
      variables: payload,
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Hashnode ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Hashnode: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  return isUpdate ? json.data.updatePost.post : json.data.publishPost.post;
}
