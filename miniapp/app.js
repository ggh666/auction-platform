const DEVTOOLS_WRAPPER_PAGE_PREFIX = "/devtools/mp-weixin/pages/";
const DEVTOOLS_WRAPPER_NAVIGATION_APIS = ["navigateTo", "redirectTo", "reLaunch", "switchTab"];

function prefixedMiniProgramUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/pages/")) {
    return url;
  }
  return `${DEVTOOLS_WRAPPER_PAGE_PREFIX}${url.slice("/pages/".length)}`;
}

function patchNavigationObject(target) {
  if (typeof target !== "object" || target === null) {
    return;
  }

  DEVTOOLS_WRAPPER_NAVIGATION_APIS.forEach((apiName) => {
    const original = target[apiName];
    if (typeof original !== "function" || original.__devtoolsWrapperPatched) {
      return;
    }

    function patchedNavigation(options) {
      if (options && typeof options === "object" && typeof options.url === "string") {
        return original.call(this, Object.assign({}, options, {
          url: prefixedMiniProgramUrl(options.url)
        }));
      }
      return original.apply(this, arguments);
    }

    patchedNavigation.__devtoolsWrapperPatched = true;
    target[apiName] = patchedNavigation;
  });
}

function patchPageNavigationUrls() {
  if (typeof wx !== "object" || wx === null) {
    return;
  }
  patchNavigationObject(wx);
}

function patchUniNavigationUrls() {
  if (typeof globalThis !== "object" || globalThis === null) {
    return;
  }
  patchNavigationObject(globalThis.uni);
}

patchPageNavigationUrls();
patchUniNavigationUrls();
require("./devtools/mp-weixin/app.js");
patchPageNavigationUrls();
patchUniNavigationUrls();
