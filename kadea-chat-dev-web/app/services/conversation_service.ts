import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import transmit from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import MessageHide from '#models/message_hide'
import User from '#models/user'

/** Fuseau d'affichage des heures. À changer ici si besoin. */
const APP_ZONE = 'Africa/Kinshasa'

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

  /** La liste de gauche : le dernier message VISIBLE par l'utilisateur. */
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
          .orderBy('id', 'desc')
          .first()

        const other = conversation.members.find((member) => member.userId !== user.id)
        const title = conversation.isGroup
          ? (conversation.name ?? 'Groupe')
          : (other?.user.fullName ?? other?.user.email ?? 'Utilisateur')

        const lastAt = (last?.createdAt ?? conversation.createdAt).setZone(APP_ZONE)
        const today = lastAt.hasSame(DateTime.now().setZone(APP_ZONE), 'day')

        let preview = 'Aucun message'
        if (last) {
          const text = last.isDeleted ? 'Ce message a été supprimé' : (last.content ?? '')
          preview = last.userId === user.id && !last.isDeleted ? `Toi : ${text}` : text
        }

        return {
          id: conversation.id,
          isGroup: conversation.isGroup,
          title,
          initials: initialsOf(title),
          preview,
          deleted: last?.isDeleted ?? false,
          time: today ? lastAt.toFormat('HH:mm') : lastAt.toFormat('dd/MM'),
          sortKey: lastAt.toMillis(),
        }
      })
    )

    return items.sort((a, b) => b.sortKey - a.sortKey)
  }

  /** Un message prêt à être affiché (l'auteur doit être chargé). */
  presentMessage(message: Message) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      userId: message.userId,
      authorName: message.author.fullName ?? message.author.email,
      content: message.content,
      isDeleted: Boolean(message.deletedAt),
      isEdited: Boolean(message.editedAt),
      time: message.createdAt.setZone(APP_ZONE).toFormat('HH:mm'),
    }
  }

  /** Les 200 derniers messages que l'utilisateur n'a pas cachés. */
  async messagesOf(conversation: Conversation, user: User) {
    const rows = await Message.query()
      .where('conversationId', conversation.id)
      .whereNotIn('id', (hidden) => {
        hidden.from('message_hides').where('user_id', user.id).select('message_id')
      })
      .preload('author')
      .orderBy('id', 'desc')
      .limit(200)

    return rows.reverse().map((message) => this.presentMessage(message))
  }

  async findMessage(conversation: Conversation, messageId: number) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversationId', conversation.id)
      .preload('author')
      .firstOrFail()

    return this.presentMessage(message)
  }

  /** « Supprimer pour moi » : le message disparaît seulement pour cet utilisateur. */
  async hideFor(user: User, conversation: Conversation, messageId: number) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversationId', conversation.id)
      .firstOrFail()

    await MessageHide.firstOrCreate({ messageId: message.id, userId: user.id })
  }

  async notifyMembers(conversationId: number, messageId: number) {
    const members = await ConversationMember.query().where('conversationId', conversationId)
    for (const member of members) {
      transmit.broadcast(`users/${member.userId}`, { conversationId, messageId })
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
}