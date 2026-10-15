import EmailTokenService from '#services/email_token_service'
import { resetPasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class ResetPasswordController {
  /** Le lien cliqué dans l'e-mail : affiche le formulaire si le jeton est valide */
  async create({ params, view, session, response }: HttpContext) {
    const record = await new EmailTokenService().find(params.token, 'reset_password')

    if (!record) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refais une demande.')
      return response.redirect().toRoute('forgot_password.create')
    }

    return view.render('pages/auth/reset_password', { token: params.token })
  }

  /** Enregistre le nouveau mot de passe */
  async store({ request, session, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    const service = new EmailTokenService()
    const record = await service.find(token, 'reset_password')

    if (!record) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Refais une demande.')
      return response.redirect().toRoute('forgot_password.create')
    }

    await service.resetPassword(record, password)

    session.flash('success', 'Ton mot de passe a été modifié. Tu peux te connecter.')
    return response.redirect().toRoute('session.create')
  }
}