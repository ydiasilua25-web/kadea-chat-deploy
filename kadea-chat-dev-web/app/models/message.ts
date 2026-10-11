import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { MessageSchema } from '#database/schema'
import Attachment from '#models/attachment'
import Conversation from '#models/conversation'
import User from '#models/user'

export default class Message extends MessageSchema {
  @belongsTo(() => Conversation)
  declare conversation: BelongsTo<typeof Conversation>

  @belongsTo(() => User)
  declare author: BelongsTo<typeof User>

  @hasMany(() => Attachment)
  declare attachments: HasMany<typeof Attachment>

  get isDeleted() {
    return this.deletedAt !== null
  }
}