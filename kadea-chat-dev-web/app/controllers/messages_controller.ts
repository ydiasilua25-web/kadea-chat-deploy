import Message from '#models/message'
import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const messageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})

export default class MessagesController {
  /** Un seul message en HTML : sert au temps réel. */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)
    const message = await service.findMessage(conversation, params.messageId)
    return view.render('partials/chat/message', { message, me, isGroup: conversation.isGroup })
  }

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

  /** Modifier un de ses messages. */
  async update({ auth, params, request, response, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

    const message = await Message.query()
      .where('id', params.messageId)
      .where('conversationId', conversation.id)
      .firstOrFail()

    if (message.userId !== me.id || message.deletedAt) {
      return response.forbidden('Tu ne peux modifier que tes propres messages.')
    }

    const { content } = await request.validateUsing(messageValidator)
    message.content = content
    message.editedAt = DateTime.now()
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

  /** Supprimer pour tout le monde (son propre message). */
  async destroy({ auth, params, request, response, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

    const message = await Message.query()
      .where('id', params.messageId)
      .where('conversationId', conversation.id)
      .firstOrFail()

    if (message.userId !== me.id) {
      return response.forbidden('Tu ne peux supprimer pour tous que tes propres messages.')
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

  /** Supprimer pour moi seulement : valable pour n'importe quel message de la conversation. */
  async hide({ auth, params, request, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)
    await service.hideFor(me, conversation, params.messageId)

    if (request.header('x-requested-with') === 'fetch') {
      return response.noContent()
    }
    return response.redirect(`/chat/${conversation.id}`)
  }
}