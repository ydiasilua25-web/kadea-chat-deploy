import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'

/** Fuseau d'affichage des heures. À changer ici si besoin. */
const APP_ZONE = 'Africa/Kinshasa'

function initialsOf(text: string) {
  const parts = text.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

export default class ConversationService {
  /** Clé unique d'une conversation privée : le plus petit identifiant toujours en premier. */
  private directKey(a: number, b: number) {
    return a < b ? `${a}:${b}` : `${b}:${a}`
  }

  /** Retrouve ou crée la conversation privée entre deux utilisateurs. */
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
      // Deux clics en même temps : la clé unique a refusé le doublon, on reprend l'existante.
      const raced = await Conversation.findBy('directKey', key)
      if (raced) return raced
      throw error
    }
  }

  /** La conversation si l'utilisateur en est membre, sinon une erreur 404. */
  async findForMember(user: User, conversationId: number) {
    return Conversation.query()
      .where('id', conversationId)
      .whereHas('members', (query) => query.where('userId', user.id))
      .firstOrFail()
  }

  /** La liste affichée dans la colonne de gauche, la plus récente en premier. */
  async listFor(user: User) {
    const conversations = await Conversation.query()
      .whereHas('members', (query) => query.where('userId', user.id))
      .preload('members', (query) => query.preload('user'))

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const last = await Message.query()
          .where('conversationId', conversation.id)
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

  /** Les 200 derniers messages, du plus ancien au plus récent. */
  async messagesOf(conversation: Conversation) {
    const rows = await Message.query()
      .where('conversationId', conversation.id)
      .preload('author')
      .orderBy('id', 'desc')
      .limit(200)

    return rows.reverse().map((message) => ({
      id: message.id,
      userId: message.userId,
      authorName: message.author.fullName ?? message.author.email,
      content: message.content,
      isDeleted: message.isDeleted,
      time: message.createdAt.setZone(APP_ZONE).toFormat('HH:mm'),
    }))
  }

  /** Recherche d'utilisateurs confirmés, par nom ou adresse e-mail. */
  async searchUsers(me: User, term: string) {
    return User.query()
      .whereNot('id', me.id)
      .whereNotNull('emailVerifiedAt')
      .where((query) => {
        query.whereILike('fullName', `%${term}%`).orWhereILike('email', `%${term}%`)
      })
      .orderBy('fullName', 'asc')
      .limit(20)
  }
}