import Block from '#models/block'
import User from '#models/user'

function initialsOf(text: string) {
  const parts = text.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

export default class BlockService {
  /** Bloque un utilisateur. Retourne false si c'est impossible (soi-même, inconnu). */
  async block(me: User, otherId: number) {
    if (me.id === otherId) return false
    const other = await User.find(otherId)
    if (!other) return false

    await Block.firstOrCreate({ blockerId: me.id, blockedId: other.id })
    return true
  }

  /** Débloque : ne touche que les blocages posés par l'utilisateur lui-même. */
  async unblock(me: User, otherId: number) {
    await Block.query().where('blockerId', me.id).where('blockedId', otherId).delete()
  }

  /** Qui a bloqué qui entre deux utilisateurs. */
  async state(me: User, otherId: number) {
    const rows = await Block.query()
      .where((query) => {
        query.where('blockerId', me.id).where('blockedId', otherId)
      })
      .orWhere((query) => {
        query.where('blockerId', otherId).where('blockedId', me.id)
      })

    return {
      iBlocked: rows.some((row) => row.blockerId === me.id),
      blockedMe: rows.some((row) => row.blockedId === me.id),
    }
  }

  /** La liste des utilisateurs que j'ai bloqués. */
  async listFor(me: User) {
    const rows = await Block.query()
      .where('blockerId', me.id)
      .preload('blocked')
      .orderBy('id', 'desc')

    return rows.map((row) => {
      const name = row.blocked.fullName ?? row.blocked.email
      return {
        userId: row.blockedId,
        name,
        email: row.blocked.email,
        initials: initialsOf(name),
        avatarPath: row.blocked.avatarPath,
      }
    })
  }
}