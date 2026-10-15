import User from '#models/user'
import EmailTokenService from '#services/email_token_service'
import { forgotPasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class ForgotPasswordController {
  /** Page « mot de passe oublié » */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/forgot_password')
  }

  /** Envoie le lien de réinitialisation (réponse identique que le compte existe ou non) */
  async store({ request, session, response, logger }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    const user = await User.findBy('email', email)

    if (user) {
      try {
        await new EmailTokenService().sendPasswordResetEmail(user)
      } catch (error) {
        logger.error({ err: error }, "Échec de l'envoi de l'e-mail de réinitialisation")
      }
    }

    session.flash(
      'success',
      "Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d'être envoyé."
    )
    return response.redirect().back()
  }
}