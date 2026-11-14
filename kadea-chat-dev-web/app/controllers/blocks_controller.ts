import BlockService from '#services/block_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

const blockValidator = vine.create({
  userId: vine.number(),
})

export default class BlocksController {
  /** La liste des utilisateurs bloqués, en HTML (fenêtre du profil). */
  async index({ auth, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const blockedUsers = await new BlockService().listFor(me)
    return view.render('partials/chat/blocked_list', { blockedUsers })
  }

  async store({ auth, request, response, session }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const { userId } = await request.validateUsing(blockValidator)

    const done = await new BlockService().block(me, userId)
    if (done) {
      session.flash('success', 'Utilisateur bloqué : il ne peut plus t’envoyer de messages.')
    } else {
      session.flash('error', 'Impossible de bloquer cet utilisateur.')
    }
    return response.redirect().back()
  }

  async destroy({ auth, params, response, session }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    await new BlockService().unblock(me, params.userId)
    session.flash('success', 'Utilisateur débloqué.')
    return response.redirect().back()
  }
}