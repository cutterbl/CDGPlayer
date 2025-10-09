import path from 'path';
import { fileURLToPath } from 'url';
import connect from 'connect';
import serveStatic from 'serve-static';
import open from 'open';
import localip from 'localip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ip = localip();
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
