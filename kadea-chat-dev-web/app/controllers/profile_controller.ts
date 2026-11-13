import User from '#models/user'
import StorageService, { MAX_AVATAR_BYTES } from '#services/storage_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine, { errors } from '@vinejs/vine'

const nameValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(100),
})

const passwordValidator = vine.create({
  currentPassword: vine.string(),
  password: vine.string().minLength(8).maxLength(32),
  passwordConfirmation: vine.string().sameAs('password'),
})

export default class ProfileController {
  async updateName({ auth, request, response, session }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    try {
      const { fullName } = await request.validateUsing(nameValidator)
      user.fullName = fullName
      await user.save()
      session.flash('success', 'Ton nom a été mis à jour.')
    } catch (error) {
      if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
      session.flash('error', 'Le nom doit contenir entre 2 et 100 caractères.')
    }
    return response.redirect().back()
  }

  async updatePassword({ auth, request, response, session }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    try {
      const data = await request.validateUsing(passwordValidator)

      try {
        await User.verifyCredentials(user.email, data.currentPassword)
      } catch {
        session.flash('error', 'Le mot de passe actuel est incorrect.')
        return response.redirect().back()
      }

      user.password = data.password
      await user.save()
      session.flash('success', 'Ton mot de passe a été modifié.')
    } catch (error) {
      if (!(error instanceof errors.E_VALIDATION_ERROR)) throw error
      session.flash(
        'error',
        'Le nouveau mot de passe doit contenir de 8 à 32 caractères et être confirmé.'
      )
    }
    return response.redirect().back()
  }

  /** Photo de profil : JPG, PNG ou WEBP, 2 Mo au maximum. */
  async updateAvatar({ auth, request, response, session, logger }: HttpContext) {
    const user = auth.use('web').getUserOrFail()
    const file = request.file('avatar', { size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] })

    if (!file) {
      session.flash('error', 'Choisis une image.')
      return response.redirect().back()
    }
    if (!file.isValid || file.size > MAX_AVATAR_BYTES) {
      session.flash('error', 'Image refusée : JPG, PNG ou WEBP, 2 Mo au maximum.')
      return response.redirect().back()
    }

    try {
      user.avatarPath = await new StorageService().uploadAvatar(file.tmpPath!, user.id)
      await user.save()
      session.flash('success', 'Ta photo de profil a été mise à jour.')
    } catch (error) {
      logger.error({ err: error }, "Échec de l'envoi de la photo de profil")
      session.flash('error', "Impossible d'enregistrer la photo pour le moment.")
    }
    return response.redirect().back()
  }

  async removeAvatar({ auth, response, session }: HttpContext) {
    const user = auth.use('web').getUserOrFail()
    user.avatarPath = null
    await user.save()
    session.flash('success', 'Ta photo de profil a été retirée.')
    return response.redirect().back()
  }
}