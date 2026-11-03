import Message from '#models/message'
import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const messageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})

export default class MessagesController {
  /** Un seul message en HTML : sert à l'affichage en temps réel. */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()

    const conversation = await service.findForMember(me, params.id)
    const message = await service.findMessage(conversation, params.messageId)

    return view.render('partials/chat/message', { message, me, isGroup: conversation.isGroup })
  }

  /** Envoie un message dans une conversation dont on est membre. */
  async store({ auth, params, request, response, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()

    const conversation = await service.findForMember(me, params.id)
    const { content } = await request.validateUsing(messageValidator)

    const message = await Message.create({
      conversationId: conversation.id,
      userId: me.id,
      content,
    })
    await message.load('author')
    await service.notifyMembers(conversation.id, message.id)

    if (request.header('x-requested-with') === 'fetch') {
      return view.render('partials/chat/message', {
        message: service.presentMessage(message),
        me,
        isGroup: conversation.isGroup,
      })
    }
    return response.redirect(`/chat/${conversation.id}`)
  }

  /** Supprime (logiquement) un message que l'on a envoyé. */
  async destroy({ auth, params, request, response, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

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
    await message.load('author')
    await service.notifyMembers(conversation.id, message.id)

    if (request.header('x-requested-with') === 'fetch') {
      return view.render('partials/chat/message', {
        message: service.presentMessage(message),
        me,
        isGroup: conversation.isGroup,
      })
    }
    return response.redirect(`/chat/${conversation.id}`)
  }
}