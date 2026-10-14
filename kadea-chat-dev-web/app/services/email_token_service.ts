import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import router from '@adonisjs/core/services/router'
import env from '#start/env'
import EmailToken from '#models/email_token'
import User from '#models/user'

export type EmailTokenType = 'verify_email' | 'reset_password'

const LIFETIME_HOURS: Record<EmailTokenType, number> = {
  verify_email: 24,
  reset_password: 1,
}

/** Empreinte (hachage SHA-256)**/
function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export default class EmailTokenService {
  /**
   * Crée un jeton pour l'utilisateur et retourne sa valeur EN CLAIR
   * (à mettre dans le lien de l'e-mail). Les anciens jetons du même type sont supprimés.
   */
  async create(user: User, type: EmailTokenType) {
    await EmailToken.query().where('userId', user.id).where('type', type).delete()

    const plainToken = randomBytes(32).toString('hex')
    await EmailToken.create({
      userId: user.id,
      type,
      tokenHash: hashToken(plainToken),
      expiresAt: DateTime.now().plus({ hours: LIFETIME_HOURS[type] }),
    })

    return plainToken
  }

  /**
   * Retourne le jeton s'il est valide (avec son utilisateur), sinon null.
   */
  async find(plainToken: string, type: EmailTokenType) {
    const record = await EmailToken.query()
      .where('tokenHash', hashToken(plainToken))
      .preload('user')
      .first()

    if (!record) return null // 1. existe-t-il ?
    if (record.type !== type) return null // 2. bon usage ?
    if (record.usedAt !== null) return null // 3. déjà utilisé ?
    if (record.expiresAt < DateTime.now()) return null // 4. expiré ?

    return record
  }

  /**
   * Confirme l'e-mail : jeton marqué utilisé ET compte vérifié,
   * ensemble ou pas du tout (transaction).
   */
  async confirmEmail(record: EmailToken) {
    await db.transaction(async (trx) => {
      record.useTransaction(trx)
      record.user.useTransaction(trx)

      record.usedAt = DateTime.now()
      record.user.emailVerifiedAt = DateTime.now()

      await record.save()
      await record.user.save()
    })
  }

  /**
   * Crée un jeton de confirmation et envoie l'e-mail.
   */
  async sendVerificationEmail(user: User) {
    const token = await this.create(user, 'verify_email')
    const url = env.get('APP_URL') + router.makeUrl('verify_email.show', { token })

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Confirme ton adresse e-mail - Kadea Chat')
        .htmlView('emails/verify_email', { user, url })
        .text(`Bienvenue sur Kadea Chat ! Confirme ton adresse e-mail : ${url}`)
    })
  }
}