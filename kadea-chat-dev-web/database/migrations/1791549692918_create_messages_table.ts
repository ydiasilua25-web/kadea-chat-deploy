import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('conversation_id').unsigned().notNullable()
        .references('id').inTable('conversations').onDelete('CASCADE')
      table
        .integer('user_id').unsigned().notNullable()
        .references('id').inTable('users')
      table.text('content').nullable()
      table.timestamp('deleted_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.index(['conversation_id', 'id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}