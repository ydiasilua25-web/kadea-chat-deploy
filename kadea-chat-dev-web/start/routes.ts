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
import transmit from '@adonisjs/transmit/services/main'

router
  .get('/', async ({ auth, response, view }) => {
    if (await auth.use('web').check()) {
      return response.redirect().toRoute('dashboard')
    }
    return view.render('pages/home')
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
    router.get('/dashboard', ({ response }) => response.redirect('/chat')).as('dashboard')
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

transmit.registerRoutes((route) => {
  if (route.getPattern() === '__transmit/subscribe') {
    route.middleware(middleware.auth())
  }
})

/**groupe chat... */
router
  .group(() => {
    router.get('welcome', [controllers.Welcome, 'show'])

    router.post('profile/name', [controllers.Profile, 'updateName'])
    router.post('profile/password', [controllers.Profile, 'updatePassword'])

    router.get('chat', [controllers.Conversations, 'index'])
    router.get('chat/new', [controllers.Conversations, 'create'])
    router.get('chat/list', [controllers.Conversations, 'list'])
    router.get('chat/users', [controllers.Conversations, 'users'])
    router.post('chat', [controllers.Conversations, 'store'])
    router
      .get('chat/:id', [controllers.Conversations, 'show'])
      .where('id', router.matchers.number())
    router
      .get('chat/:id/messages/:messageId', [controllers.Messages, 'show'])
      .where('id', router.matchers.number())
      .where('messageId', router.matchers.number())
    router
      .post('chat/:id/messages', [controllers.Messages, 'store'])
      .where('id', router.matchers.number())
    router
      .post('chat/:id/messages/:messageId/edit', [controllers.Messages, 'update'])
      .where('id', router.matchers.number())
      .where('messageId', router.matchers.number())
    router
      .post('chat/:id/messages/:messageId/delete', [controllers.Messages, 'destroy'])
      .where('id', router.matchers.number())
      .where('messageId', router.matchers.number())
    router
      .post('chat/:id/messages/:messageId/hide', [controllers.Messages, 'hide'])
      .where('id', router.matchers.number())
      .where('messageId', router.matchers.number())

    router.post('groups', [controllers.Groups, 'store'])
    router
      .post('chat/:id/members', [controllers.Groups, 'addMembers'])
      .where('id', router.matchers.number())
    router
      .post('chat/:id/members/:userId/remove', [controllers.Groups, 'removeMember'])
      .where('id', router.matchers.number())
      .where('userId', router.matchers.number())
  })
  .use(middleware.auth())