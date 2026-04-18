const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const student = await prisma.student.create({
      data: { name: 'Test Student', classGrade: 10, languagePref: 'en' }
    });
    console.log('Success:', student);
  } catch (e) {
    console.error('PRISMA_ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
