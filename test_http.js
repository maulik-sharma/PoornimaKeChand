const http = require('http');
require('dotenv').config();
const { prisma } = require('./src/lib/db/prisma.js');

async function main() {
  const student = await prisma.student.findFirst({ orderBy: { createdAt: 'desc' } });
  const diagnostic = await prisma.diagnosticSession.findFirst({
    where: { studentId: student.id },
    orderBy: { completedAt: 'desc' },
  });
  await prisma.$disconnect();

  console.log("Calling /api/curriculum/generate with:");
  console.log("  studentId:", student.id);
  console.log("  diagnosticId:", diagnostic.id);

  const body = JSON.stringify({ studentId: student.id, diagnosticId: diagnostic.id });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/curriculum/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log("STATUS:", res.statusCode);
      console.log("RESPONSE:", data);
    });
  });

  req.on('error', (e) => console.error("REQUEST ERROR:", e.message));
  req.write(body);
  req.end();
}

main();
