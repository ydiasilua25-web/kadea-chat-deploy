import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ConversationSchema } from '#database/schema'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'

export default class Conversation extends ConversationSchema {
  @column()
  declare type: 'private' | 'group'

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => ConversationMember)
  declare members: HasMany<typeof ConversationMember>

  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>

  get isGroup() {
    return this.type === 'group'
  }
}