/**
 * Chronicle / Google SecOps Documentation Extractor
 */
window.SecOpsDocsExtractor = {
  matches(url) {
    return (
      url.includes("docs.cloud.google.com/chronicle") ||
      url.includes("cloud.google.com/chronicle") ||
      url.includes("docs.cloud.google.com/security-operations") ||
      url.includes("cloud.google.com/security-operations") ||
      url.includes("chronicle/docs")
    );
  },

  extract() {
    // Title
    const titleEl = document.querySelector("h1, .devsite-page-title");
    const docTitle = titleEl ? titleEl.textContent.trim() : document.title;

    // Breadcrumbs
    const breadcrumbs = [];
    document.querySelectorAll(".devsite-breadcrumb-item, nav[aria-label='Breadcrumb'] li").forEach((el) => {
      const text = el.textContent.trim();
      if (text) breadcrumbs.push(text);
    });

    // Main article content (strip navigation, search, and footer)
    const contentEl = document.querySelector("article, .devsite-article-body, main, [role='main']");
    let contentText = "";
    if (contentEl) {
      // Clone so we don't mutate the live page
      const clone = contentEl.cloneNode(true);
      // Remove scripts, styles, navigation widgets inside article
      clone.querySelectorAll("script, style, nav, .devsite-nav, button").forEach((el) => el.remove());
      contentText = clone.textContent.replace(/\s+/g, " ").trim();
    } else {
      contentText = document.body.innerText.replace(/\s+/g, " ").trim();
    }

    return {
      feature: "Google SecOps Documentation",
      docTitle: docTitle,
      breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs.join(" > ") : null,
      contentSnippet: window.SecOpsDOMUtils.truncate(contentText, 5000)
    };
  }
};
