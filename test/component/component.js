Component({
  properties: {},
  data: {
    data: []
  },
  lifetimes: {
    created: function() {
      console.log("super props");
    },
    attached: function() {
      // 页面创建时执行
      console.info("Page loaded!");
    },
    detached: function() {
      // 页面销毁时执行
      console.info("Page unloaded!");
    }
  },
  methods: {
    isReadCountShow: function(readCount) {
      return readCount > 300;
    },
    onClick: function(e) {
      window.open(e.currentTarget.dataset.url, "_blank");
    }
  }
});
