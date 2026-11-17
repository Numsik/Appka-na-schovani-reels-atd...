const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { afterEach, test } = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const resources = join(__dirname, "../Extension/Resources");
const filterSource = readFileSync(join(resources, "filter.js"), "utf8");
const popupSource = readFileSync(join(resources, "popup.js"), "utf8");
const popupHTML = readFileSync(join(resources, "popup.html"), "utf8");
const hidden = "data-reels-filter-hidden";
const redirecting = "data-reels-filter-redirecting";
const pages = [];
const settle = () => new Promise(resolve => setImmediate(resolve));

function createStorage(initial = {}) {
  const values = { ...initial };
  const listeners = new Set();
  const storage = {
    local: {
      get: async defaults => ({ ...defaults, ...values }),
      async set(patch) {
        const changes = {};
        for (const [key, value] of Object.entries(patch)) {
          changes[key] = { oldValue: values[key], newValue: value };
          values[key] = value;
        }
        storage.emit(changes);
      },
    },
    onChanged: { addListener: listener => listeners.add(listener) },
    emit(changes, areaName = "local") {
      for (const listener of listeners) listener(changes, areaName);
    },
  };
  return storage;
}

function createPage(markup = "", { storage = createStorage(), path = "/", popup = false } = {}) {
  const dom = new JSDOM(popup ? popupHTML : markup, {
    url: new URL(path, "https://www.instagram.com/"),
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const observers = [];
  const timers = new Set();
  const redirects = [];
  window.HTMLMediaElement.prototype.pause = function () {
    this.pauseCount = (this.pauseCount ?? 0) + 1;
  };
  pages.push({ dom, observers });

  vm.runInNewContext(popup ? popupSource : filterSource, {
    window,
    document: window.document,
    browser: { storage },
    Element: window.Element,
    URL,
    location: {
      get href() { return window.location.href; },
      get origin() { return window.location.origin; },
      replace: url => redirects.push(String(url)),
    },
    MutationObserver: class extends window.MutationObserver {
      constructor(callback) {
        super(callback);
        observers.push(this);
      }
    },
    setInterval(callback) { timers.add(callback); return callback; },
    clearInterval(callback) { timers.delete(callback); },
  });

  return {
    window, document: window.document, storage, redirects, timers,
    checkRoutes() { for (const callback of timers) callback(); },
  };
}

afterEach(() => {
  for (const { dom, observers } of pages.splice(0)) {
    for (const observer of observers) observer.disconnect();
    dom.window.close();
  }
});

test("hides Reel navigation and profile tabs while preserving other destinations", async () => {
  const hrefs = [
    "/reels/?x=2", "/reel/a1/", "/creator/reels/", "https://instagram.com/share/reel/b2/",
    "/direct/inbox/", "/p/a1/", "/stories/reels/a1/", "/creator/reels-archive/",
    "https://other.example/reels/", "https://www.instagram.com.evil.example/reel/a1/",
  ];
  const { document } = createPage(hrefs.map(href => `<a href="${href}">Item</a>`).join(""));
  await settle();
  assert.deepEqual([...document.querySelectorAll(`a[${hidden}]`)].map(link => link.getAttribute("href")), hrefs.slice(0, 4));
});

test("uses the post permalink and preserves an ordinary post linking to a Reel in a comment", async () => {
  const { document } = createPage(`
    <article id="post"><a href="/p/1/"><time>Post</time></a>
      <a href="/reel/2/"><time>Comment link</time></a><video></video></article>
    <div role="article" id="reel"><a href="/reel/2/"><time>Post</time></a><video></video></div>
    <article id="caption"><a href="/reel/2/">Caption link</a></article>
  `);
  await settle();
  assert.equal(document.getElementById("post").hasAttribute(hidden), false);
  assert.equal(document.getElementById("post").querySelector("video").pauseCount, undefined);
  assert.equal(document.getElementById("reel").hasAttribute(hidden), true);
  assert.ok(document.getElementById("reel").querySelector("video").pauseCount > 0);
  assert.equal(document.getElementById("caption").hasAttribute(hidden), false);
});

test("updates newly inserted and reused feed elements", async () => {
  const { document } = createPage();
  await settle();
  document.body.innerHTML = '<article><a href="/reel/42/"><time>New post</time></a></article>';
  await settle();
  const article = document.querySelector("article");
  const link = article.querySelector("a");
  assert.equal(article.hasAttribute(hidden), true);
  assert.equal(link.hasAttribute(hidden), true);

  link.href = "/p/42/";
  await settle();
  assert.equal(article.hasAttribute(hidden), false);
  assert.equal(link.hasAttribute(hidden), false);

  link.href = "/reel/42/";
  await settle();
  link.remove();
  await settle();
  link.removeAttribute("href");
  article.append(link);
  await settle();
  assert.equal(article.hasAttribute(hidden), false);
  assert.equal(link.hasAttribute(hidden), false);
});

test("cancels a Reel click before a newly added link has been observed", async () => {
  const { window, document } = createPage();
  await settle();
  document.body.innerHTML = '<a href="/reel/42/"><span>Reel</span></a>';
  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  let received = false;
  document.addEventListener("click", () => { received = true; });
  document.querySelector("span").dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(received, false);
});

test("restores hidden content in every tab and filters content loaded while disabled", async () => {
  const storage = createStorage();
  const first = createPage('<a href="/reels/">Reels</a>', { storage });
  const second = createPage('<a href="/reel/42/">Reel</a>', { storage });
  await settle();
  await storage.local.set({ enabled: false });
  assert.equal(first.document.querySelector(`[${hidden}]`), null);
  assert.equal(second.document.querySelector(`[${hidden}]`), null);
  assert.equal(first.timers.size, 0);
  first.document.body.innerHTML += '<a href="/reel/43/">New Reel</a>';
  await settle();
  assert.equal(first.document.querySelector(`[${hidden}]`), null);

  await storage.local.set({ enabled: true });
  assert.equal(first.document.querySelectorAll(`[${hidden}]`).length, 2);
  assert.equal(second.document.querySelectorAll(`[${hidden}]`).length, 1);
  assert.equal(first.timers.size, 1);
});

test("honors a saved disabled preference on a direct Reel URL", async () => {
  const page = createPage('<a href="/reels/">Reels</a>', {
    path: "/reel/42/", storage: createStorage({ enabled: false }),
  });
  await settle();
  assert.deepEqual(page.redirects, []);
  assert.equal(page.document.querySelector(`[${hidden}]`), null);
  assert.equal(page.timers.size, 0);
  await page.storage.local.set({ enabled: true });
  assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
  assert.equal(page.document.documentElement.hasAttribute(redirecting), true);
});

test("a delayed settings read cannot overwrite a newer change", async () => {
  const storage = createStorage();
  let finishRead;
  storage.local.get = () => new Promise(resolve => { finishRead = resolve; });
  const { document } = createPage('<a href="/reels/">Reels</a>', { storage });
  await storage.local.set({ enabled: false });
  finishRead({ enabled: true });
  await settle();
  assert.equal(document.querySelector(`[${hidden}]`), null);
  await storage.local.set({ enabled: true });
  assert.ok(document.querySelector(`[${hidden}]`));
});

test("uses the enabled default when storage fails and ignores other storage areas", async () => {
  const storage = createStorage();
  storage.local.get = async () => { throw new Error("Unavailable"); };
  const { document } = createPage('<a href="/reels/">Reels</a>', { storage });
  await settle();
  assert.ok(document.querySelector(`[${hidden}]`));
  storage.emit({ enabled: { newValue: false } }, "sync");
  assert.ok(document.querySelector(`[${hidden}]`));
  await storage.local.set({ enabled: false });
  storage.emit({ enabled: {} });
  assert.ok(document.querySelector(`[${hidden}]`));
});

test("catches a pushState transition without DOM changes and clears its guard on return", async () => {
  const page = createPage();
  await settle();
  page.window.history.pushState(null, "", "/direct/inbox/");
  page.checkRoutes();
  assert.deepEqual(page.redirects, []);

  page.window.history.pushState(null, "", "/reel/42/");
  page.checkRoutes();
  page.checkRoutes();
  assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
  assert.equal(page.document.documentElement.hasAttribute(redirecting), true);

  page.window.history.replaceState(null, "", "/");
  page.checkRoutes();
  assert.equal(page.document.documentElement.hasAttribute(redirecting), false);
});

test("redirects direct Reel addresses and responds to browser history", async () => {
  for (const path of ["/reels/", "/reel/42/", "/creator/reels/", "/share/reel/42/?x=1"]) {
    const page = createPage("", { path });
    await settle();
    assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
  }
  const page = createPage();
  await settle();
  page.window.history.pushState(null, "", "/reel/42/");
  page.window.dispatchEvent(new page.window.PopStateEvent("popstate"));
  assert.deepEqual(page.redirects, ["https://www.instagram.com/"]);
});

test("stops playback in a hidden card and allows media in messages", async () => {
  const { document, window, storage } = createPage(`
    <a href="/reel/42/"><video id="reel"></video></a>
    <div><video id="message"></video></div>
  `);
  await settle();
  const reel = document.getElementById("reel");
  reel.pauseCount = 0;
  reel.dispatchEvent(new window.Event("play"));
  assert.equal(reel.pauseCount, 1);
  const message = document.getElementById("message");
  message.dispatchEvent(new window.Event("play"));
  assert.equal(message.pauseCount, undefined);
  await storage.local.set({ enabled: false });
  reel.dispatchEvent(new window.Event("play"));
  assert.equal(reel.pauseCount, 1);
});

test("the popup saves a preference, updates an open tab and persists across page loads", async () => {
  const storage = createStorage({ enabled: false });
  const content = createPage('<a href="/reels/">Reels</a>', { storage });
  const popup = createPage("", { popup: true, storage });
  await settle();
  const toggle = popup.document.getElementById("enabled");
  assert.equal(toggle.checked, false);
  assert.equal(toggle.disabled, false);
  toggle.checked = true;
  toggle.dispatchEvent(new popup.window.Event("change"));
  assert.equal(toggle.disabled, true);
  await settle();
  assert.equal(toggle.checked, true);
  assert.equal(toggle.disabled, false);
  assert.ok(content.document.querySelector(`[${hidden}]`));
  const reloaded = createPage('<a href="/reels/">Reels</a>', { storage });
  await settle();
  assert.ok(reloaded.document.querySelector(`[${hidden}]`));
});

test("the popup restores the saved value and permits retry after a failed write", async () => {
  const storage = createStorage();
  const popup = createPage("", { popup: true, storage });
  await settle();
  storage.local.set = async () => { throw new Error("Storage unavailable"); };
  const toggle = popup.document.getElementById("enabled");
  toggle.checked = false;
  toggle.dispatchEvent(new popup.window.Event("change"));
  await settle();
  assert.equal(toggle.checked, true);
  assert.equal(toggle.disabled, false);
  assert.match(popup.document.getElementById("status").textContent, /nepodařilo uložit/);
});

test("the popup keeps a newer setting even if its initial read fails", async () => {
  const storage = createStorage();
  let rejectRead;
  storage.local.get = () => new Promise((resolve, reject) => { rejectRead = reject; });
  const popup = createPage("", { popup: true, storage });
  await storage.local.set({ enabled: false });
  rejectRead(new Error("Old read failed"));
  await settle();
  assert.equal(popup.document.getElementById("enabled").checked, false);
  assert.equal(popup.document.getElementById("enabled").disabled, false);
  assert.equal(popup.document.getElementById("status").textContent, "Filtr je vypnutý.");
});

test("the popup reports a load error while the saved setting is unknown", async () => {
  const storage = createStorage();
  storage.local.get = async () => { throw new Error("Unavailable"); };
  const popup = createPage("", { popup: true, storage });
  await settle();
  assert.equal(popup.document.getElementById("enabled").disabled, true);
  assert.match(popup.document.getElementById("status").textContent, /nepodařilo načíst/);
});
