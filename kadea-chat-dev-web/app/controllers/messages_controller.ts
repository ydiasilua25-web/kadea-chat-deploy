import Message from '#models/message'
import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import Attachment from '#models/attachment'
import StorageService, {
  ALLOWED_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  isImageExtension,
} from '#services/storage_service'

const messageValidator = vine.create({
  content: vine.string().trim().minLength(1).maxLength(2000),
})

export default class MessagesController {
  /** Un seul message en HTML : sert au temps réel. */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)
    const message = await service.findMessage(conversation, params.messageId, me)
    return view.render('partials/chat/message', { message, me, isGroup: conversation.isGroup })
  }

    /** Envoie un message (texte, fichier, ou les deux). */
  async store({ auth, params, request, response, view, logger }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

    const rawContent = request.input('content')
    const content = typeof rawContent === 'string' ? rawContent.trim() : ''
    const file = request.file('file', { size: '10mb', extnames: ALLOWED_EXTENSIONS })

    if (!content && !file) {
      return response.unprocessableEntity('Écris un message ou joins un fichier.')
    }
    if (content.length > 2000) {
      return response.unprocessableEntity('Le message est trop long (2000 caractères maximum).')
    }

    let publicId: string | null = null
    let extension = ''
    if (file) {
      extension = (file.extname ?? '').toLowerCase()
      const limit = isImageExtension(extension) ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES

      if (!file.isValid || file.size > limit) {
        return response.unprocessableEntity(
          'Fichier refusé : images (jpg, png, gif, webp) de 5 Mo maximum, documents (pdf, word, excel, powerpoint, txt, csv) de 10 Mo maximum.'
        )
      }

      try {
        publicId = await new StorageService().uploadAttachment(
          file.tmpPath!,
          extension,
          conversation.id
        )
      } catch (error) {
        logger.error({ err: error }, "Échec de l'envoi d'un fichier")
        return response.unprocessableEntity("Impossible d'envoyer le fichier pour le moment.")
      }
    }

    const message = await Message.create({
      conversationId: conversation.id,
      userId: me.id,
      content: content || null,
    })

    if (file && publicId) {
      await Attachment.create({
        messageId: message.id,
        storagePath: publicId,
        originalName: file.clientName,
        mimeType: isImageExtension(extension)
          ? `image/${extension === 'jpg' ? 'jpeg' : extension}`
          : `${file.type}/${file.subtype}`,
        sizeBytes: file.size,
      })
    }

    await message.load('author')
    await message.load('attachments')
    await service.notifyMembers(conversation.id, message.id)

    if (request.header('x-requested-with') === 'fetch') {
      return view.render('partials/chat/message', {
        message: await service.presentFor(message, conversation, me),
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
        message: await service.presentFor(message, conversation, me),
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
        message: await service.presentFor(message, conversation, me),
        me,
        isGroup: conversation.isGroup,
      })
    }
    return response.redirect(`/chat/${conversation.id}`)
  }

  /** Supprimer pour moi seulement. */
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