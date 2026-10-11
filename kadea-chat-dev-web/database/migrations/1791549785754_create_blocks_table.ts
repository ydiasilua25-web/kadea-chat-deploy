import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'blocks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('blocker_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table
        .integer('blocked_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.unique(['blocker_id', 'blocked_id'])
    })
     this.schema.raw(
      'ALTER TABLE blocks ADD CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_id)'
    )
  } 
}