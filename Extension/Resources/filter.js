(() => {
  "use strict";

  const instagramHosts = new Set(["www.instagram.com", "instagram.com"]);
  const reelPath = /^\/(?:reels?(?:\/|$)|share\/reel(?:\/|$)|[a-z0-9._]+\/reels\/?$)/i;
  const postPath = /^\/(?:p|reel)\/[^/]+\/?$/i;
  const articleSelector = 'article, [role="article"]';
  const hiddenAttribute = "data-reels-filter-hidden";
  const redirectingAttribute = "data-reels-filter-redirecting";
  const linkSelector = `a[href], a[${hiddenAttribute}]`;
  const storage = (globalThis.browser ?? globalThis.chrome).storage;
  let enabled;
  let redirectingFrom;
  let routeTimer;
  let settingsRevision = 0;

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

  function redirectReelPage() {
    const blocked = Boolean(enabled && reelPath.test(instagramPath(location.href)));
    document.documentElement?.toggleAttribute(redirectingAttribute, blocked);

    if (blocked && redirectingFrom !== location.href) {
      redirectingFrom = location.href;
      for (const video of document.querySelectorAll("video")) video.pause();
      location.replace(new URL("/", location.origin));
    }
    if (!blocked) redirectingFrom = undefined;
    return blocked;
  }

  function blockReelLink(event) {
    if (!enabled) return;
    const link = event.target?.closest?.("a[href]");
    if (link && reelPath.test(instagramPath(link.getAttribute("href")))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function setHidden(element, hidden) {
    element.toggleAttribute(hiddenAttribute, hidden);
    if (hidden) {
      for (const video of element.querySelectorAll("video")) video.pause();
    }
  }

  function updateLink(link) {
    const href = link.getAttribute("href");
    setHidden(link, href !== null && reelPath.test(instagramPath(href)));
  }

  function updateArticle(article) {
    // The first post permalink attached to a timestamp identifies the post itself.
    // Links in captions and comments can point to a different post.
    for (const timestamp of article.querySelectorAll("a[href] time")) {
      if (timestamp.closest(articleSelector) !== article) continue;
      const path = instagramPath(timestamp.closest("a").getAttribute("href"));
      if (postPath.test(path)) {
        setHidden(article, reelPath.test(path));
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
  document.addEventListener("visibilitychange", redirectReelPage);
  document.addEventListener("play", (event) => {
    const video = event.target;
    if (enabled && video.matches?.("video") && video.closest(`[${hiddenAttribute}]`)) {
      video.pause();
    }
  }, true);

  const observer = new MutationObserver((changes) => {
    if (!enabled || redirectReelPage()) return;

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

  function applyEnabled(value) {
    const nextEnabled = value !== false;
    if (nextEnabled === enabled) return;
    enabled = nextEnabled;

    observer.disconnect();
    clearInterval(routeTimer);
    if (!enabled) {
      document.documentElement?.removeAttribute(redirectingAttribute);
      redirectingFrom = undefined;
      for (const element of document.querySelectorAll(`[${hiddenAttribute}]`)) {
        element.removeAttribute(hiddenAttribute);
      }
      return;
    }

    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    if (redirectReelPage()) return;

    const articles = new Set();
    if (document.documentElement) scanSubtree(document.documentElement, articles);
    for (const article of articles) updateArticle(article);

    // Safari versions without the Navigation API also need to catch pushState
    // transitions that do not mutate the document or emit popstate.
    routeTimer = setInterval(() => {
      if (!document.hidden) redirectReelPage();
    }, 400);
  }

  storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !Object.hasOwn(changes, "enabled")) return;
    settingsRevision += 1;
    applyEnabled(changes.enabled.newValue);
  });

  const revisionAtRead = settingsRevision;
  storage.local.get({ enabled: true }).then((settings) => {
    if (settingsRevision === revisionAtRead) applyEnabled(settings.enabled);
  }).catch(() => {
    if (settingsRevision === revisionAtRead) applyEnabled(true);
  });
})();
