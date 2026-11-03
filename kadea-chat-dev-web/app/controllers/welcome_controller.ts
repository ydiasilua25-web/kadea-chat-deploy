import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class WelcomeController {
  /** Affichée une seule fois, juste après la première connexion. */
  async show({ auth, response, view }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    if (user.welcomedAt) {
      return response.redirect('/chat')
    }

    user.welcomedAt = DateTime.now()
    await user.save()
    return view.render('pages/welcome', { user })
  }
}