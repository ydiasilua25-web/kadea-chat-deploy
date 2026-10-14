import User from '#models/user'
import EmailTokenService from '#services/email_token_service'
import { resendVerificationValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class VerifyEmailController {
  /** Page « vérifie ta boîte mail » */
  async notice({ view }: HttpContext) {
    return view.render('pages/auth/verify_email_notice')
  }

  /** Le lien cliqué dans l'e-mail */
  async show({ params, session, response }: HttpContext) {
    const service = new EmailTokenService()
    const record = await service.find(params.token, 'verify_email')

    if (!record) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Demande un nouvel e-mail.')
      return response.redirect().toRoute('verify_email.notice')
    }

    await service.confirmEmail(record)
    session.flash('success', 'Ton adresse e-mail est confirmée. Tu peux te connecter.')
    return response.redirect().toRoute('session.create')
  }

  /** Renvoyer l'e-mail de confirmation */
  async resend({ request, session, response, logger }: HttpContext) {
    const { email } = await request.validateUsing(resendVerificationValidator)
    const user = await User.findBy('email', email)

    if (user && !user.isEmailVerified) {
      try {
        await new EmailTokenService().sendVerificationEmail(user)
      } catch (error) {
        logger.error({ err: error }, "Échec du renvoi de l'e-mail de confirmation")
      }
    }

    session.flash(
      'success',
      "Si un compte non confirmé existe avec cette adresse, un nouvel e-mail vient d'être envoyé."
    )
    return response.redirect().toRoute('verify_email.notice')
  }
}