// @ts-check
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/curriculum/[curriculumId]
 * Return a curriculum with its full module list, for the /learn page.
 */
export async function GET(req, { params }) {
  try {
    const { curriculumId } = params;

    if (!curriculumId) {
      return NextResponse.json({ error: "curriculumId required" }, { status: 400 });
    }

    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      include: {
        modules: {
          orderBy: { orderIndex: "asc" },
          include: {
            prerequisites: {
              select: { id: true, topic: true, status: true },
            },
          },
        },
        student: {
          select: { name: true, classGrade: true, languagePref: true },
        },
        diagnostic: {
          select: { abilityScore: true, gapMapJson: true, subject: true },
        },
      },
    });

    if (!curriculum) {
      return NextResponse.json({ error: "Curriculum not found" }, { status: 404 });
    }

    return NextResponse.json({ curriculum });
  } catch (err) {
    console.error("[curriculum/get] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
