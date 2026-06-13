<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" doctype-system="about:legacy-compat" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS feed</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;700&amp;family=Public+Sans:wght@400;500;600&amp;display=swap');
          :root { --bg:#faf9f6; --ink:#1c1b18; --dim:#6b6960; --accent:#9e2b35; --border:#e6e3da; }
          * { box-sizing:border-box; }
          body { margin:0; background:var(--bg); color:var(--ink);
            font:17px/1.75 'Public Sans',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
          .wrap { max-width:720px; margin:0 auto; padding:3rem 1.25rem 5rem; }
          .brand { display:flex; align-items:center; gap:.6rem; margin-bottom:2rem; }
          .brand img { width:40px; height:40px; }
          .brand .name { font-family:'Libre Bodoni',Georgia,serif; font-weight:700; font-size:1.5rem; letter-spacing:-.01em; }
          .pill { margin-left:.5rem; padding:.15rem .55rem; border:1px solid var(--accent); border-radius:999px;
            color:var(--accent); font-size:.66rem; font-weight:600; text-transform:uppercase; letter-spacing:.12em; }
          h1 { font-family:'Libre Bodoni',Georgia,serif; font-weight:700; font-size:2.4rem; line-height:1.15; margin:0 0 .4rem; letter-spacing:-.01em; }
          .lede { color:var(--dim); margin:0 0 1.25rem; }
          .note { background:#fff; border:1px solid var(--border); border-left:3px solid var(--accent);
            padding:.9rem 1.1rem; border-radius:0 6px 6px 0; font-size:.95rem; color:var(--ink); margin-bottom:2.5rem; }
          .note code { background:#f1efe8; padding:.1rem .35rem; border-radius:3px; font-size:.85em; }
          a { color:var(--accent); text-decoration:none; }
          a:hover { text-decoration:underline; text-underline-offset:3px; }
          .count { font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--dim);
            border-bottom:1px solid var(--ink); padding-bottom:.5rem; margin-bottom:.5rem; }
          .item { border-bottom:1px solid var(--border); padding:1.5rem 0; }
          .item h2 { font-family:'Libre Bodoni',Georgia,serif; font-weight:700; font-size:1.45rem; line-height:1.2; margin:0 0 .35rem; }
          .item h2 a { color:var(--ink); }
          .item h2 a:hover { color:var(--accent); text-decoration:none; }
          .meta { font-size:.74rem; text-transform:uppercase; letter-spacing:.08em; font-weight:600; color:var(--dim); margin-bottom:.5rem; }
          .meta .tag { color:var(--accent); margin-left:.5rem; }
          .desc { margin:0; color:var(--dim); }
          footer { margin-top:2.5rem; color:var(--dim); font-size:.85rem; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="brand">
            <img src="/favicon.svg" alt=""/>
            <span class="name">iSymbolic</span>
            <span class="pill">RSS feed</span>
          </div>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description"/></p>
          <div class="note">
            This is a web feed. Copy the URL from your address bar into a feed reader
            (Feedly, NetNewsWire, Reeder…) to subscribe and get new posts automatically.
            Just want to read? Visit
            <a href="{/rss/channel/link}">the blog</a>.
          </div>
          <p class="count">
            <xsl:value-of select="count(/rss/channel/item)"/> recent <xsl:choose><xsl:when test="count(/rss/channel/item)=1">post</xsl:when><xsl:otherwise>posts</xsl:otherwise></xsl:choose>
          </p>
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
              <div class="meta">
                <xsl:value-of select="substring(pubDate, 1, 16)"/>
                <xsl:for-each select="category"><span class="tag">#<xsl:value-of select="."/></span></xsl:for-each>
              </div>
              <p class="desc"><xsl:value-of select="description"/></p>
            </div>
          </xsl:for-each>
          <footer>Generated feed · <a href="{/rss/channel/link}">isymbolic-blog.vercel.app</a></footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
