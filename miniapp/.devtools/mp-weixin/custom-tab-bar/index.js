const tabList = [
  { pagePath: "pages/games/index", text: "资源" },
  { pagePath: "pages/profile/index", text: "我的" }
];
const USER_KEY = "auction.user.profile";
const LOGIN_PROFILE_URL = "/pages/login/login?redirect=%2Fpages%2Fprofile%2Findex";

function hasUserSession() {
  const user = wx.getStorageSync(USER_KEY);
  return Boolean(user && typeof user === "object" && user.id);
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
      const pages = getCurrentPages();
      return pages.length > 0 ? pages[pages.length - 1].route : "";
    },
    setSelected(selected) {
      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },
    updateSelected() {
      const selected = tabList.findIndex((item) => item.pagePath === this.currentRoute());
      this.setSelected(selected);
    },
    switchTab(event) {
      const targetIndex = Number(event.currentTarget.dataset.index);
      const pagePath = event.currentTarget.dataset.path;
      if (!pagePath || !Number.isInteger(targetIndex) || targetIndex < 0) {
        return;
      }
      if (targetIndex === this.data.selected && this.currentRoute() === pagePath) {
        return;
      }
      if (pagePath === "pages/profile/index" && !hasUserSession()) {
        wx.navigateTo({ url: LOGIN_PROFILE_URL });
        return;
      }
      this.setData({ selected: targetIndex });
      wx.switchTab({ url: `/${pagePath}` });
    }
  }
});
