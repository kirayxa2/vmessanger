import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const conversationId = parseInt(params.id);
        const userId = parseInt(session.user.id);

        // Update the `clearedAt` timestamp for this user in this conversation
        const participant = await prisma.conversationParticipant.update({
            where: {
                userId_conversationId: {
                    userId,
                    conversationId,
                },
            },
            data: {
                clearedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, clearedAt: participant.clearedAt });
    } catch (error) {
        console.error("Error clearing conversation history:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
