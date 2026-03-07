import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const conversationId = parseInt(id);
        const userId = parseInt(session.user.id);

        // Get the parsing state
        const { action } = await request.json(); // { action: "archive" | "unarchive" }

        if (!action || !["archive", "unarchive"].includes(action)) {
            return new NextResponse("Bad Request: missing required valid 'action'", { status: 400 });
        }

        // Upsert or Update the participant record
        const participant = await prisma.conversationParticipant.update({
            where: {
                userId_conversationId: {
                    userId,
                    conversationId,
                },
            },
            data: {
                isArchived: action === "archive",
            },
        });

        return NextResponse.json({ success: true, isArchived: participant.isArchived });
    } catch (error) {
        console.error("Error archiving conversation:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
