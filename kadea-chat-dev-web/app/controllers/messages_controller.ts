import Message from '#models/message'
import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const messageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})

export default class MessagesController {
  /** Envoie un message dans une conversation dont on est membre. */
  async store({ auth, params, request, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const conversation = await new ConversationService().findForMember(me, params.id)
    const { content } = await request.validateUsing(messageValidator)

    await Message.create({ conversationId: conversation.id, userId: me.id, content })
    return response.redirect(`/chat/${conversation.id}`)
  }

  /** Supprime (logiquement) un message que l'on a envoyé. */
  async destroy({ auth, params, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const conversation = await new ConversationService().findForMember(me, params.id)

    const message = await Message.query()
      .where('id', params.messageId)
      .where('conversationId', conversation.id)
      .firstOrFail()

    if (message.userId !== me.id) {
      return response.forbidden('Tu ne peux supprimer que tes propres messages.')
    }

    message.content = null
    message.deletedAt = DateTime.now()
    await message.save()

    return response.redirect(`/chat/${conversation.id}`)
  }
}