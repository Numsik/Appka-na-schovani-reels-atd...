(() => {
  "use strict";

  const instagramHosts = new Set(["www.instagram.com", "instagram.com"]);
  const reelPath = /^\/(?:reels?(?:\/|$)|share\/reel(?:\/|$)|[a-z0-9._]+\/reels\/?$)/i;
  const postPath = /^\/(?:p|reel)\/[^/]+\/?$/i;
  const articleSelector = 'article, [role="article"]';
  const hiddenAttribute = "data-reels-filter-hidden";
  const linkSelector = `a[href], a[${hiddenAttribute}]`;

  function instagramPath(href) {
    try {
      const url = new URL(href, document.baseURI);
      if (url.protocol === "https:" && instagramHosts.has(url.host)) {
        return url.pathname;
      }
    } catch {
      // Ignore malformed links.
    }
    return "";
  }

  let redirecting = false;

  function redirectReelPage() {
    if (!redirecting && reelPath.test(instagramPath(location.href))) {
      redirecting = true;
      location.replace(new URL("/", location.origin));
    }
    return redirecting;
  }

  if (redirectReelPage()) return;

  function blockReelLink(event) {
    const link = event.target?.closest?.("a[href]");
    if (link && reelPath.test(instagramPath(link.getAttribute("href")))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function updateLink(link) {
    const href = link.getAttribute("href");
    link.toggleAttribute(hiddenAttribute, href !== null && reelPath.test(instagramPath(href)));
  }

  function updateArticle(article) {
    // The first post permalink attached to a timestamp identifies the post itself.
    // Links in captions and comments can point to a different post.
    for (const timestamp of article.querySelectorAll("a[href] time")) {
      if (timestamp.closest(articleSelector) !== article) continue;
      const path = instagramPath(timestamp.closest("a").getAttribute("href"));
      if (postPath.test(path)) {
        article.toggleAttribute(hiddenAttribute, reelPath.test(path));
        return;
      }
    }
    article.removeAttribute(hiddenAttribute);
  }

  function scanSubtree(element, articles) {
    if (element.matches(linkSelector)) updateLink(element);
    for (const link of element.querySelectorAll(linkSelector)) updateLink(link);

    if (element.matches(articleSelector)) articles.add(element);
    for (const article of element.querySelectorAll(articleSelector)) articles.add(article);
  }

  window.addEventListener("click", blockReelLink, true);
  window.addEventListener("auxclick", blockReelLink, true);
  window.addEventListener("popstate", redirectReelPage);
  window.addEventListener("pageshow", redirectReelPage);
  window.navigation?.addEventListener("currententrychange", redirectReelPage);

  const observer = new MutationObserver((changes) => {
    if (redirectReelPage()) return;

    const articles = new Set();
    for (const change of changes) {
      const parentArticle = change.target.closest?.(articleSelector);
      if (parentArticle) articles.add(parentArticle);

      if (change.type === "attributes") {
        if (change.target.matches("a")) updateLink(change.target);
        continue;
      }

      for (const node of change.addedNodes) {
        if (node instanceof Element && node.isConnected) scanSubtree(node, articles);
      }
    }
    for (const article of articles) updateArticle(article);
  });

  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });

  if (document.documentElement) {
    const articles = new Set();
    scanSubtree(document.documentElement, articles);
    for (const article of articles) updateArticle(article);
  }
})();
