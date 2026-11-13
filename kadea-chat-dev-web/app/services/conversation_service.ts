import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import transmit from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import MessageHide from '#models/message_hide'
import User from '#models/user'
import { formatBytes } from '#services/storage_service'

/** Fuseau d'affichage des heures. À changer ici si besoin. */
const APP_ZONE = 'Africa/Kinshasa'

type MessageStatus = 'sent' | 'delivered' | 'read'

function initialsOf(text: string) {
  const parts = text.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

export default class ConversationService {
  private directKey(a: number, b: number) {
    return a < b ? `${a}:${b}` : `${b}:${a}`
  }

  async findOrCreatePrivate(me: User, other: User) {
    const key = this.directKey(me.id, other.id)

    const existing = await Conversation.findBy('directKey', key)
    if (existing) return existing

    try {
      return await db.transaction(async (trx) => {
        const conversation = await Conversation.create(
          { type: 'private', directKey: key, createdBy: me.id },
          { client: trx }
        )
        await ConversationMember.createMany(
          [
            { conversationId: conversation.id, userId: me.id, role: 'member' },
            { conversationId: conversation.id, userId: other.id, role: 'member' },
          ],
          { client: trx }
        )
        return conversation
      })
    } catch (error) {
      const raced = await Conversation.findBy('directKey', key)
      if (raced) return raced
      throw error
    }
  }

  async findForMember(user: User, conversationId: number) {
    return Conversation.query()
      .where('id', conversationId)
      .whereHas('members', (query) => query.where('userId', user.id))
      .firstOrFail()
  }

  /** La liste de gauche : dernier message visible, heure, non lus, photo de l'interlocuteur. */
  async listFor(user: User) {
    const conversations = await Conversation.query()
      .whereHas('members', (query) => query.where('userId', user.id))
      .preload('members', (query) => query.preload('user'))

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const last = await Message.query()
          .where('conversationId', conversation.id)
          .whereNotIn('id', (hidden) => {
            hidden.from('message_hides').where('user_id', user.id).select('message_id')
          })
          .preload('attachments')
          .orderBy('id', 'desc')
          .first()

        const mine = conversation.members.find((member) => member.userId === user.id)
        const lastRead = mine?.lastReadMessageId ?? 0

        const unreadRow = await Message.query()
          .where('conversationId', conversation.id)
          .whereNot('userId', user.id)
          .where('id', '>', lastRead)
          .whereNull('deletedAt')
          .whereNotIn('id', (hidden) => {
            hidden.from('message_hides').where('user_id', user.id).select('message_id')
          })
          .count('* as total')
          .first()
        const unread = Number(unreadRow?.$extras.total ?? 0)

        const other = conversation.members.find((member) => member.userId !== user.id)
        const title = conversation.isGroup
          ? (conversation.name ?? 'Groupe')
          : (other?.user.fullName ?? other?.user.email ?? 'Utilisateur')

        const lastAt = (last?.createdAt ?? conversation.createdAt).setZone(APP_ZONE)
        const today = lastAt.hasSame(DateTime.now().setZone(APP_ZONE), 'day')

        let preview = 'Aucun message'
        if (last) {
          const file = last.attachments?.[0]
          const kind = file ? (file.mimeType.startsWith('image/') ? 'Photo' : 'Document') : ''
          const text = last.isDeleted ? 'Ce message a été supprimé' : (last.content ?? kind)
          preview = last.userId === user.id && !last.isDeleted ? `Toi : ${text}` : text
        }

        return {
          id: conversation.id,
          isGroup: conversation.isGroup,
          memberCount: conversation.members.length,
          title,
          initials: initialsOf(title),
          avatarUrl: conversation.isGroup ? null : (other?.user.avatarPath ?? null),
          otherUserId: conversation.isGroup ? null : (other?.userId ?? null),
          preview,
          deleted: last?.isDeleted ?? false,
          unread,
          time: today ? lastAt.toFormat('HH:mm') : lastAt.toFormat('dd/MM'),
          sortKey: lastAt.toMillis(),
        }
      })
    )

    return items.sort((a, b) => b.sortKey - a.sortKey)
  }

   /** Un message prêt à être affiché (auteur et pièces jointes chargés). */
  presentMessage(message: Message, status: MessageStatus | null = null) {
    const file = message.attachments?.[0]
    return {
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId,
      authorName: message.author.fullName ?? message.author.email,
      content: message.content,
      hasText: Boolean(message.content),
      isDeleted: Boolean(message.deletedAt),
      isEdited: Boolean(message.editedAt),
      status,
      attachment: file
        ? {
            id: file.id,
            name: file.originalName,
            size: formatBytes(file.sizeBytes),
            isImage: file.mimeType.startsWith('image/'),
            url: `/chat/${message.conversationId}/files/${file.id}`,
          }
        : null,
      time: message.createdAt.setZone(APP_ZONE).toFormat('HH:mm'),
    }
  }

  /** Jusqu'où TOUS les autres membres ont reçu et lu : le plus en retard décide. */
  async statusCursors(conversation: Conversation, me: User) {
    const others = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .whereNot('userId', me.id)

    if (others.length === 0) return { minDelivered: 0, minRead: 0 }

    return {
      minDelivered: Math.min(...others.map((member) => member.lastDeliveredMessageId ?? 0)),
      minRead: Math.min(...others.map((member) => member.lastReadMessageId ?? 0)),
    }
  }

  private statusFor(
    message: Message,
    me: User,
    cursors: { minDelivered: number; minRead: number }
  ): MessageStatus | null {
    if (message.userId !== me.id) return null
    if (message.id <= cursors.minRead) return 'read'
    if (message.id <= cursors.minDelivered) return 'delivered'
    return 'sent'
  }

  /** Un message avec son statut calculé pour l'utilisateur. */
  async presentFor(message: Message, conversation: Conversation, me: User) {
    const cursors = await this.statusCursors(conversation, me)
    return this.presentMessage(message, this.statusFor(message, me, cursors))
  }

  /** Les 200 derniers messages que l'utilisateur n'a pas cachés. */
  async messagesOf(conversation: Conversation, user: User) {
    const cursors = await this.statusCursors(conversation, user)

    const rows = await Message.query()
      .where('conversationId', conversation.id)
      .whereNotIn('id', (hidden) => {
        hidden.from('message_hides').where('user_id', user.id).select('message_id')
      })
      .preload('author')
      .preload('attachments')
      .orderBy('id', 'desc')
      .limit(200)

    return rows
      .reverse()
      .map((message) => this.presentMessage(message, this.statusFor(message, user, cursors)))
  }

  async findMessage(conversation: Conversation, messageId: number, me: User) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversationId', conversation.id)
      .preload('author')
      .preload('attachments')
      .firstOrFail()

    return this.presentFor(message, conversation, me)
  }

  /** « Supprimer pour moi » : le message disparaît seulement pour cet utilisateur. */
  async hideFor(user: User, conversation: Conversation, messageId: number) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversationId', conversation.id)
      .firstOrFail()

    await MessageHide.firstOrCreate({ messageId: message.id, userId: user.id })
  }

  /**
   * Prévient en temps réel tous les membres.
   * messageId vaut null quand seule la liste ou les coches doivent se mettre à jour.
   */
  async notifyMembers(conversationId: number, messageId: number | null, status = false) {
    const members = await ConversationMember.query().where('conversationId', conversationId)
    for (const member of members) {
      transmit.broadcast(`users/${member.userId}`, { conversationId, messageId, status })
    }
  }

  /** « Lu » : l'utilisateur a vu la conversation jusqu'à son dernier message. */
  async markRead(user: User, conversation: Conversation) {
    const last = await Message.query()
      .where('conversationId', conversation.id)
      .orderBy('id', 'desc')
      .first()
    if (!last) return

    const member = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .where('userId', user.id)
      .firstOrFail()

    const read = member.lastReadMessageId ?? 0
    const delivered = member.lastDeliveredMessageId ?? 0
    if (read >= last.id && delivered >= last.id) return

    // Les marque-pages n'avancent que vers l'avant.
    member.lastReadMessageId = Math.max(read, last.id)
    member.lastDeliveredMessageId = Math.max(delivered, last.id)
    await member.save()

    await this.notifyMembers(conversation.id, null, true)
  }

  /** « Reçu » : l'utilisateur est connecté, tous ses messages en attente sont considérés reçus. */
  async markAllDelivered(user: User) {
    const result = await db.rawQuery(
      `UPDATE conversation_members AS cm
       SET last_delivered_message_id = m.max_id
       FROM (SELECT conversation_id, MAX(id) AS max_id FROM messages GROUP BY conversation_id) AS m
       WHERE cm.conversation_id = m.conversation_id
         AND cm.user_id = ?
         AND (cm.last_delivered_message_id IS NULL OR cm.last_delivered_message_id < m.max_id)
       RETURNING cm.conversation_id`,
      [user.id]
    )

    for (const row of result.rows) {
      await this.notifyMembers(row.conversation_id, null, true)
    }
  }

  async listUsers(me: User, term = '') {
    const query = User.query()
      .whereNot('id', me.id)
      .whereNotNull('emailVerifiedAt')
      .orderBy('fullName', 'asc')
      .limit(500)

    if (term.trim().length > 0) {
      const like = `%${term.trim()}%`
      query.where((group) => {
        group.whereILike('fullName', like).orWhereILike('email', like)
      })
    }

    return query
  }

  /** Crée un groupe : le créateur en est l'administrateur. Retourne null s'il n'y a aucun membre valide. */
  async createGroup(me: User, name: string, userIds: number[]) {
    const ids = [...new Set(userIds)].filter((id) => id !== me.id)
    const users = await User.query().whereIn('id', ids).whereNotNull('emailVerifiedAt')
    if (users.length === 0) return null

    const conversation = await db.transaction(async (trx) => {
      const group = await Conversation.create(
        { type: 'group', name, createdBy: me.id },
        { client: trx }
      )
      await ConversationMember.createMany(
        [
          { conversationId: group.id, userId: me.id, role: 'admin' as const },
          ...users.map((user) => ({
            conversationId: group.id,
            userId: user.id,
            role: 'member' as const,
          })),
        ],
        { client: trx }
      )
      return group
    })

    await this.notifyMembers(conversation.id, null)
    return conversation
  }

  async isAdmin(user: User, conversation: Conversation) {
    const member = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .where('userId', user.id)
      .first()
    return member?.role === 'admin'
  }

  /** Les membres d'un groupe, administrateur en premier. */
  async membersOf(conversation: Conversation) {
    const rows = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .preload('user')

    return rows
      .map((member) => {
        const name = member.user.fullName ?? member.user.email
        return {
          userId: member.userId,
          name,
          email: member.user.email,
          initials: initialsOf(name),
          isAdmin: member.role === 'admin',
        }
      })
      .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name, 'fr'))
  }

  /** Les utilisateurs confirmés qui ne sont pas encore dans le groupe. */
  async candidatesFor(conversation: Conversation) {
    return User.query()
      .whereNotNull('emailVerifiedAt')
      .whereNotIn('id', (members) => {
        members
          .from('conversation_members')
          .where('conversation_id', conversation.id)
          .select('user_id')
      })
      .orderBy('fullName', 'asc')
      .limit(500)
  }

  async addMembers(conversation: Conversation, userIds: number[]) {
    const users = await User.query()
      .whereIn('id', [...new Set(userIds)])
      .whereNotNull('emailVerifiedAt')

    for (const user of users) {
      await ConversationMember.firstOrCreate(
        { conversationId: conversation.id, userId: user.id },
        { role: 'member' }
      )
    }
    await this.notifyMembers(conversation.id, null)
  }

  /** Retire un membre (jamais l'administrateur) et le prévient en temps réel. */
  async removeMember(conversation: Conversation, userId: number) {
    const member = await ConversationMember.query()
      .where('conversationId', conversation.id)
      .where('userId', userId)
      .where('role', 'member')
      .first()
    if (!member) return

    await member.delete()
    transmit.broadcast(`users/${userId}`, {
      conversationId: conversation.id,
      messageId: null,
      removed: true,
    })
  }
}