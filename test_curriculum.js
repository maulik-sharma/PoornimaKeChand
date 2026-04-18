require('dotenv').config();
const { prisma } = require('./src/lib/db/prisma.js');

async function main() {
  console.log("--- Checking latest student and diagnostic in DB ---");
  
  const student = await prisma.student.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log("Latest student:", student);
  
  if (!student) { console.log("No students found"); process.exit(0); }
  
  const diagnostic = await prisma.diagnosticSession.findFirst({
    where: { studentId: student.id },
    orderBy: { completedAt: 'desc' },
  });
  console.log("Latest diagnostic:", diagnostic);
  
  if (!diagnostic) { console.log("No diagnostic found for this student"); process.exit(0); }
  
  console.log("\n--- Now simulating curriculum/generate logic ---");
  
  const { NCERT_SEQUENCES } = require('./src/lib/content/ncert-sequences.js');
  const ncertSequence = NCERT_SEQUENCES[diagnostic.subject]?.[student.classGrade] ?? [];
  console.log("NCERT sequence count:", ncertSequence.length);
  console.log("gapMapJson:", diagnostic.gapMapJson);
  console.log("abilityScore:", diagnostic.abilityScore);
  
  await prisma.$disconnect();
}
main().catch(e => { console.error("FATAL:", e); process.exit(1); });
