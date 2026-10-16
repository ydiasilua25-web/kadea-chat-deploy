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

router
  .get('/', async ({ auth, response }) => {
    if (await auth.use('web').check()) {
      return response.redirect().toRoute('dashboard')
    }
    return response.redirect().toRoute('session.create')
  })
  .as('home')

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

router.get('verify-email', [controllers.VerifyEmail, 'notice'])
router.get('verify-email/:token', [controllers.VerifyEmail, 'show'])
router.post('verify-email/resend', [controllers.VerifyEmail, 'resend'])

router.get('forgot-password', [controllers.ForgotPassword, 'create'])
router.post('forgot-password', [controllers.ForgotPassword, 'store'])
router.get('reset-password/:token', [controllers.ResetPassword, 'create'])
router.post('reset-password', [controllers.ResetPassword, 'store'])