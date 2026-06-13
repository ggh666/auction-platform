type CustomTabBar = {
  setData?: (data: { selected: number }) => void;
};

type PageWithTabBar = {
  getTabBar?: () => CustomTabBar | null;
};

function applyCustomTabBarSelected(selected: number) {
  const pages = getCurrentPages() as PageWithTabBar[];
  const currentPage = pages[pages.length - 1];
  const tabBar = typeof currentPage?.getTabBar === "function" ? currentPage.getTabBar() : null;
  if (typeof tabBar?.setData === "function") {
    tabBar.setData({ selected });
  }
}

export function syncCustomTabBarSelected(selected: number) {
  if (!Number.isInteger(selected) || selected < 0) {
    return;
  }

  applyCustomTabBarSelected(selected);
  setTimeout(() => applyCustomTabBarSelected(selected), 50);
  setTimeout(() => applyCustomTabBarSelected(selected), 150);
}
