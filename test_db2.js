require('dotenv').config();
const { prisma } = require('./src/lib/db/prisma.js');

async function main() {
  try {
    const student = await prisma.student.create({
      data: { name: 'Test Student', classGrade: 10, languagePref: 'en' }
    });
    console.log('Success:', student);
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
