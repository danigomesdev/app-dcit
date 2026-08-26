const React = require("react");
const { Text } = require("react-native");

function makeIconSet(family) {
  return function Icon({ name, ...props }) {
    return React.createElement(Text, props, `${family}:${name}`);
  };
}

module.exports = new Proxy(
  {},
  {
    get: (_target, family) => makeIconSet(String(family)),
  },
);
