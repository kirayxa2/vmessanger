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
        const body = await request.json().catch(() => ({}))
        const forBoth = body?.forBoth === true

        // Проверяем что юзер участник чата
        const participant = await prisma.conversationParticipant.findUnique({
            where: { userId_conversationId: { userId, conversationId } }
        })
        if (!participant) return new NextResponse("Forbidden", { status: 403 })

        if (forBoth) {
            // Удаляем все сообщения для всех участников
            await prisma.message.deleteMany({ where: { conversationId } })
            // Сбрасываем clearedAt у всех
            await prisma.conversationParticipant.updateMany({
                where: { conversationId },
                data: { clearedAt: new Date() }
            })
        } else {
            // Только для себя — ставим clearedAt
            await prisma.conversationParticipant.update({
                where: { userId_conversationId: { userId, conversationId } },
                data: { clearedAt: new Date() }
            })
        }

        return NextResponse.json({ success: true, forBoth });
    } catch (error) {
        console.error("Error clearing conversation history:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
