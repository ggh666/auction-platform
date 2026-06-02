const tabList = [
  { pagePath: "pages/games/index", text: "资源" },
  { pagePath: "pages/profile/index", text: "我的" }
];

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
    updateSelected() {
      const pages = getCurrentPages();
      const currentRoute = pages.length > 0 ? pages[pages.length - 1].route : "";
      const selected = tabList.findIndex((item) => item.pagePath === currentRoute);
      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },
    switchTab(event) {
      const pagePath = event.currentTarget.dataset.path;
      if (!pagePath) {
        return;
      }
      wx.switchTab({ url: `/${pagePath}` });
    }
  }
});
