class TestResizeObserver {
  constructor(callback) { this.callback = callback; }
  observe(target) {
    this.callback([{ target, contentRect: { width: 800, height: 280 } }]);
  }
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = TestResizeObserver;
global.IS_REACT_ACT_ENVIRONMENT = true;
