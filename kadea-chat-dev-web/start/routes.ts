/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import mail from '@adonisjs/mail/services/main'

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.on('/dashboard').render('pages/dashboard').as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())


router.get('/test-email', async () => {
  await mail.send((message) => {
    message
      .to('omer.sporer@ethereal.email')
      .subject('Test AdonisJS')
      .text('Bonjour ! Ceci est mon premier e-mail envoyé avec AdonisJS.')
  })

  return 'E-mail envoyé avec succès !'
})
