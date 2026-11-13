import Attachment from '#models/attachment'
import ConversationService from '#services/conversation_service'
import StorageService from '#services/storage_service'
import type { HttpContext } from '@adonisjs/core/http'
import { Readable } from 'node:stream'

export default class AttachmentsController {
  /** Ouvre ou télécharge un fichier, seulement pour un membre de la conversation. */
  async show({ auth, params, request, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const conversation = await new ConversationService().findForMember(me, params.id)

    const attachment = await Attachment.query()
      .where('id', params.attachmentId)
      .whereHas('message', (query) => {
        query.where('conversationId', conversation.id).whereNull('deletedAt')
      })
      .firstOrFail()

    const isImage = attachment.mimeType.startsWith('image/')
    const url = new StorageService().signedUrl(attachment.storagePath, isImage)
    const download = request.input('download') === '1'

    if (isImage && !download) {
      return response.redirect(url)
    }

    const upstream = await fetch(url)
    if (!upstream.ok || !upstream.body) {
      return response.notFound('Fichier introuvable.')
    }

    response.header('Content-Type', attachment.mimeType)
    response.header(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
    )
    return response.stream(Readable.fromWeb(upstream.body as never))
  }
}