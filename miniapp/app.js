const DEVTOOLS_WRAPPER_PAGE_PREFIX = "/devtools/mp-weixin/pages/";

function prefixedMiniProgramUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/pages/")) {
    return url;
  }
  return `${DEVTOOLS_WRAPPER_PAGE_PREFIX}${url.slice("/pages/".length)}`;
}

function patchPageNavigationUrls() {
  if (typeof wx !== "object" || wx === null) {
    return;
  }

  ["navigateTo", "redirectTo", "reLaunch", "switchTab"].forEach((apiName) => {
    const original = wx[apiName];
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
    wx[apiName] = patchedNavigation;
  });
}

patchPageNavigationUrls();
require("./devtools/mp-weixin/app.js");
