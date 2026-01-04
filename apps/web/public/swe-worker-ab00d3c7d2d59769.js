try {
  !(function () {
    var e =
        "undefined" != typeof window
          ? window
          : "undefined" != typeof global
            ? global
            : "undefined" != typeof globalThis
              ? globalThis
              : "undefined" != typeof self
                ? self
                : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "1f786d1a-f80d-4b59-bf5e-a864281452f7"),
      (e._sentryDebugIdIdentifier =
        "sentry-dbid-1f786d1a-f80d-4b59-bf5e-a864281452f7"));
  })();
} catch (e) {}
(() => {
  "use strict";
  self.onmessage = async (e) => {
    switch (e.data.type) {
      case "__START_URL_CACHE__": {
        let t = e.data.url,
          a = await fetch(t);
        if (!a.redirected) return (await caches.open("start-url")).put(t, a);
        return Promise.resolve();
      }
      case "__FRONTEND_NAV_CACHE__": {
        let t = e.data.url,
          a = await caches.open("pages");
        if (await a.match(t, { ignoreSearch: !0 })) return;
        let r = await fetch(t);
        if (!r.ok) return;
        return (a.put(t, r.clone()), Promise.resolve());
      }
      default:
        return Promise.resolve();
    }
  };
})();
