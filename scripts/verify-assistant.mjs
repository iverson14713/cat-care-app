/**
 * Call the local assistant API health endpoint (server must already be running).
 * Usage: npm run verify:assistant
 */
import http from 'node:http';

const port = Number(process.env.ASSISTANT_SERVER_PORT || 8788);
const url = `http://127.0.0.1:${port}/api/assistant/health`;

http
  .get(url, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      console.log(body);
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  })
  .on('error', (err) => {
    console.error(`Cannot reach ${url}: ${err.message}`);
    console.error('Start the API first: npm run dev  or  npm run dev:server');
    process.exit(1);
  });
