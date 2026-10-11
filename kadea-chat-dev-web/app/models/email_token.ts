import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { EmailTokenSchema } from '#database/schema'
import User from '#models/user'

export default class EmailToken extends EmailTokenSchema {
  @column()
  declare type: 'verify_email' | 'reset_password'

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}