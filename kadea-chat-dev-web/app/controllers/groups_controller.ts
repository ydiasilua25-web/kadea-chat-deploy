import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine, { errors } from '@vinejs/vine'

const groupValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(60),
  userIds: vine.array(vine.number()).minLength(1).maxLength(100),
})

const membersValidator = vine.create({
  userIds: vine.array(vine.number()).minLength(1).maxLength(100),
})

export default class GroupsController {
  /** Créer un groupe. */
  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.use('web').getUserOrFail()

    try {
      const { name, userIds } = await request.validateUsing(groupValidator)
      const conversation = await new ConversationService().createGroup(me, name, userIds)

      if (!conversation) {
        session.flash('error', 'Choisis au moins un membre valide.')
        return response.redirect().back()
      }
      return response.redirect(`/chat/${conversation.id}`)
    } catch (error) {
      if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
      session.flash(
        'error',
        'Donne un nom au groupe (2 à 60 caractères) et choisis au moins un membre.'
      )
      return response.redirect().back()
    }
  }

  /** Ajouter des membres : réservé à l'administrateur. */
  async addMembers({ auth, params, request, response, session }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

    if (!(await service.isAdmin(me, conversation))) {
      return response.forbidden('Seul un administrateur peut ajouter des membres.')
    }

    try {
      const { userIds } = await request.validateUsing(membersValidator)
      await service.addMembers(conversation, userIds)
    } catch (error) {
      if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
      session.flash('error', 'Choisis au moins une personne à ajouter.')
    }
    return response.redirect(`/chat/${conversation.id}`)
  }

  /** Retirer un membre : réservé à l'administrateur. */
  async removeMember({ auth, params, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)

    if (!(await service.isAdmin(me, conversation))) {
      return response.forbidden('Seul un administrateur peut retirer des membres.')
    }

    await service.removeMember(conversation, params.userId)
    return response.redirect(`/chat/${conversation.id}`)
  }
}