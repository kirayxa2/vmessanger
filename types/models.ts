export interface IUser {
  id: number
  email: string
  username: string
  avatar?: string | null
  bio?: string | null
  lastSeen?: string | null
  createdAt: string
}

export interface IMessage {
  id: number | string
  content: string
  createdAt: string
  isRead?: boolean
  senderId: number
  receiverId?: number | null
  conversationId: number | string
  replyToId?: number | null
  forwardFromId?: number | null
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  fileType?: string | null
  voiceUrl?: string | null
  voiceDuration?: number | null
  selfDestructAt?: string | null
  sender: IUserPreview
  replyTo?: IReplyPreview | null
  reactions?: IReaction[]
}

export interface IUserPreview {
  id: number | string
  username: string
  avatar?: string | null
}

export interface IReplyPreview {
  id: number
  content: string
  sender: IUserPreview
}

export interface IConversation {
  id: number | string
  isGroup: boolean
  name?: string | null
  avatar?: string | null
  description?: string | null
  type: "private" | "saved" | "system" | "group"
  pinnedMessageId?: number | null
  maxMembers: number
  createdAt: string
  updatedAt: string
  participants: IParticipant[]
  messages: IMessage[]
  drafts?: IDraft[]
  _realId?: number
}

export interface IParticipant {
  id: number
  userId: number
  conversationId: number
  role: "owner" | "admin" | "member"
  user: IUserPreview
}

export interface IDraft {
  id: number
  text: string
  replyToId?: number | null
  userId: number
  conversationId: number
}

export interface IReaction {
  id: number
  messageId: number
  userId: number
  emoji: string
  createdAt: string
  user: { id: number; username: string }
}

export interface IPinnedMessage {
  pinnedMessageId: number
  pinnedMessage: IMessage
  conversationId: number
}
