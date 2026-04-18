const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/curriculum/cmo4bhvj00006kotfdtc67le6',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log(JSON.stringify(parsed.curriculum?.weeklyTargetJson, null, 2));
  });
});

req.end();
