const React = require('react');
const { View } = require('react-native');

const MockWebView = React.forwardRef((props, ref) => {
  return React.createElement(View, {
    ...props,
    ref,
    testID: props.testID || 'mock-webview',
  });
});

module.exports = {
  WebView: MockWebView,
  default: MockWebView,
};
