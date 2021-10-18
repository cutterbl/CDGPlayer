const path = require('path');
const connect = require('connect');
const serveStatic = require('serve-static');
const open = require('open');
const ip = require('localip')();
const port = 8081;

const setHeaders = (res) => {
  res.setHeader('Content-Type', 'application/javascript');
};

connect()
  .use(serveStatic(__dirname))
  .use(
    '/js',
    serveStatic(path.join(__dirname, '../dist'), {
      index: false,
      setHeaders: setHeaders,
    })
  )
  .use(
    '/node_modules',
    serveStatic(path.join(__dirname, '../node_modules'), {
      index: false,
      setHeaders: setHeaders,
    })
  )
  .listen(port, function () {
    console.log(`Server running on http://${ip}:${port} ...`);
    open(`http://${ip}:${port}`);
  });
