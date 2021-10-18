const path = require('path');
const autoprefixer = require('autoprefixer');
const assets = require('postcss-assets');

module.exports = function (ctx) {
  return {
    plugins: [assets(), autoprefixer()],
  };
};
