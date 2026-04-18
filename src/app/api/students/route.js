// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/students
 * Create a new student record.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, classGrade, languagePref = "en" } = body;

    if (!name || !classGrade) {
      return NextResponse.json({ error: "name and classGrade required" }, { status: 400 });
    }
    if (classGrade < 6 || classGrade > 12) {
      return NextResponse.json({ error: "classGrade must be 6–12" }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: { name: name.trim(), classGrade: Number(classGrade), languagePref },
    });

    return NextResponse.json({ studentId: student.id, name: student.name }, { status: 201 });
  } catch (err) {
    console.error("[students] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
