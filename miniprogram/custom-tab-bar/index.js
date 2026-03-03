Component({
  data: {
    selected: 0,
    color: '#64748b',
    selectedColor: '#4f46e5',
    list: [
      { pagePath: '/pages/home/index', text: '首页', icon: '⌂', activeIcon: '⌂' },
      { pagePath: '/pages/todo/index', text: '待办', icon: '✓', activeIcon: '✓' },
      { pagePath: '/pages/project/index', text: '项目', icon: '◈', activeIcon: '◈' },
      { pagePath: '/pages/finance/index', text: '财务', icon: '¥', activeIcon: '¥' },
      { pagePath: '/pages/mine/index', text: '我的', icon: '◉', activeIcon: '◉' }
    ]
  },
  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      if (!pages.length) return;
      const current = pages[pages.length - 1];
      const route = `/${current.route}`;
      const idx = this.data.list.findIndex((item) => item.pagePath === route);
      if (idx >= 0 && idx !== this.data.selected) {
        this.setData({ selected: idx });
      }
    }
  },
  methods: {
    onItemTap(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (!item) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
