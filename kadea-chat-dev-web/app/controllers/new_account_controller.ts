import User from '#models/user'
import EmailTokenService from '#services/email_token_service'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  /**
   * Crée le compte (non confirmé) et envoie l'e-mail de confirmation.
   * L'utilisateur n'est PAS connecté : il doit d'abord confirmer son adresse.
   */
  async store({ request, response, logger }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)
    const user = await User.create({ fullName, email, password })

    try {
      await new EmailTokenService().sendVerificationEmail(user)
    } catch (error) {
      logger.error({ err: error }, "Échec de l'envoi de l'e-mail de confirmation")
    }

    response.redirect().toRoute('verify_email.notice')
  }
}