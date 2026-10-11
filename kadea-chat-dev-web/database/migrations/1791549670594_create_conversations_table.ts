import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'conversations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum('type', ['private', 'group']).notNullable()
      table.string('name', 100).nullable()
      table.string('direct_key', 50).nullable().unique()
      table
        .integer('created_by').unsigned().notNullable()
        .references('id').inTable('users')
        
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}