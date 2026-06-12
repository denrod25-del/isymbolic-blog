import matter from 'gray-matter';

/** Parse a post file's raw text into { data, content }. */
export function parsePost(raw) {
  const { data, content } = matter(raw);
  return { data, content };
}

/** Return new raw text with the given frontmatter fields added/overwritten. */
export function setFields(raw, fields) {
  const { data, content } = matter(raw);
  return matter.stringify(content, { ...data, ...fields });
}
