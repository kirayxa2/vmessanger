"use client"

import { use } from "react"
import HomePage from "../page"

export default function ChatIdPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  return <HomePage conversationId={resolvedParams.id} />
}
