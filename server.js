const connect = require('connect');
const serveStatic = require('serve-static');
const open = require('open');
const port = 8081;
connect()
  .use(serveStatic(__dirname))
  .listen(port, function () {
    console.log(`Server running on ${port}...`);
    open(`http://localhost:${port}`);
  });
