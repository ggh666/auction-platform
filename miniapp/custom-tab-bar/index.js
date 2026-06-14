const tabList = [
  { pagePath: "pages/games/index", text: "资源" },
  { pagePath: "pages/profile/index", text: "我的" }
];
const DEVTOOLS_WRAPPER_PREFIX = "devtools/mp-weixin/";
const USER_KEY = "auction.user.profile";
const PROFILE_PAGE_PATH = "pages/profile/index";
const LOGIN_PAGE_PATH = "pages/login/login";

function hasUserSession() {
  const user = wx.getStorageSync(USER_KEY);
  return Boolean(user && typeof user === "object" && user.id);
}

function currentRoute() {
  const pages = getCurrentPages();
  return pages.length > 0 ? pages[pages.length - 1].route : "";
}

function normalizeRoute(route) {
  if (typeof route !== "string") {
    return "";
  }
  return route.startsWith(DEVTOOLS_WRAPPER_PREFIX)
    ? route.slice(DEVTOOLS_WRAPPER_PREFIX.length)
    : route;
}

function routePrefix() {
  return currentRoute().startsWith(DEVTOOLS_WRAPPER_PREFIX) ? DEVTOOLS_WRAPPER_PREFIX : "";
}

function prefixedPagePath(pagePath) {
  return `${routePrefix()}${pagePath}`;
}

function loginProfileUrl() {
  const redirect = encodeURIComponent(`/${prefixedPagePath(PROFILE_PAGE_PATH)}`);
  return `/${prefixedPagePath(LOGIN_PAGE_PATH)}?redirect=${redirect}`;
}

Component({
  data: {
    selected: 0,
    list: tabList
  },
  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },
  pageLifetimes: {
    show() {
      this.updateSelected();
    }
  },
  methods: {
    currentRoute() {
      return currentRoute();
    },
    setSelected(selected) {
      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },
    updateSelected() {
      const selected = tabList.findIndex((item) => item.pagePath === normalizeRoute(this.currentRoute()));
      this.setSelected(selected);
    },
    switchTab(event) {
      const targetIndex = Number(event.currentTarget.dataset.index);
      const pagePath = event.currentTarget.dataset.path;
      if (!pagePath || !Number.isInteger(targetIndex) || targetIndex < 0) {
        return;
      }
      if (targetIndex === this.data.selected && normalizeRoute(this.currentRoute()) === pagePath) {
        return;
      }
      if (pagePath === PROFILE_PAGE_PATH && !hasUserSession()) {
        wx.navigateTo({ url: loginProfileUrl() });
        return;
      }
      this.setData({ selected: targetIndex });
      wx.switchTab({ url: `/${prefixedPagePath(pagePath)}` });
    }
  }
});
