const http = require('http');
const fs = require('fs');
const path = require('path');
const port = 3000;

const server = http.createServer(function(req, res) {
  console.log(`${req.method} request for ${req.url}`);

  const headers = {
    // 'Access-Control-Allow-Origin': 'http://localhost:8080',
    'Access-Control-Allow-Origin': '*', // this allows any domain to access the server
    'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    'Access-Control-Max-Age': 2592000, // 30 days
    /** add other headers as per requirement */
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  if (!['GET', 'POST'].includes(req.method)) {
    res.writeHead(405, headers);
    res.end(`${req.method} is not allowed for the req.`);
    return;
  }
  
  const filePath = path.join(__dirname, 'public', req.url);
  console.log('Trying to access file: ', filePath);
  res.writeHead(200, headers);
  const readStream = fs.createReadStream(filePath, 'UTF-8');
  readStream.on('error', function () {
    res.writeHead(404, headers);
    res.end('File Not Found');
    console.log('File Not Found');
  });
  readStream.on('end', function(){
    res.end(''); //end write stream manually when readstream ends
    console.log('File retrieved');
  });
  readStream.pipe(res,{end:false}); // prevent default behaviour
}).listen(port);

console.log('Server created and listening on port 3000');