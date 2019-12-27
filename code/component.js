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
      // Executed when the component instance enters the page node tree
      console.info("Page loaded!");
    },
    detached: function() {
      // Executed when the component instance is removed from the page node tree
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
