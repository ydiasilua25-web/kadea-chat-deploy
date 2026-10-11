import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ConversationMemberSchema } from '#database/schema'
import Conversation from '#models/conversation'
import Message from '#models/message'
import User from '#models/user'

export default class ConversationMember extends ConversationMemberSchema {
  @column()
  declare role: 'admin' | 'member'

  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Message, { foreignKey: 'lastDeliveredMessageId' })
  declare lastDeliveredMessage: BelongsTo<typeof Message>

  @belongsTo(() => Message, { foreignKey: 'lastReadMessageId' })
  declare lastReadMessage: BelongsTo<typeof Message>

  get isAdmin() {
    return this.role === 'admin'
  }
}