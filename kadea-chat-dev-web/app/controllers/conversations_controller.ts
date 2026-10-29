import User from '#models/user'
import ConversationService from '#services/conversation_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

const startValidator = vine.create({
  userId: vine.number(),
})

export default class ConversationsController {
  /** Liste des conversations, aucune discussion ouverte. */
  async index({ auth, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const conversations = await new ConversationService().listFor(me)
    return view.render('pages/chat/index', { conversations, currentId: null, focus: false })
  }

  /** Recherche d'un utilisateur pour démarrer une conversation. */
  async create({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const term = String(request.input('q', '')).trim()

    const [conversations, users] = await Promise.all([
      service.listFor(me),
      term.length >= 2 ? service.searchUsers(me, term) : Promise.resolve([]),
    ])

    return view.render('pages/chat/new', { conversations, users, term, currentId: null, focus: true })
  }

  /** Démarre (ou rouvre) une conversation privée. */
  async store({ auth, request, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const { userId } = await request.validateUsing(startValidator)

    const other = await User.findOrFail(userId)
    if (other.id === me.id || !other.isEmailVerified) {
      return response.redirect('/chat/new')
    }

    const conversation = await new ConversationService().findOrCreatePrivate(me, other)
    return response.redirect(`/chat/${conversation.id}`)
  }

  /** Une discussion ouverte, avec ses messages. */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()

    const conversation = await service.findForMember(me, params.id)
    const [conversations, messages] = await Promise.all([
      service.listFor(me),
      service.messagesOf(conversation),
    ])
    const current = conversations.find((item) => item.id === conversation.id)!

    return view.render('pages/chat/show', {
      conversations,
      current,
      currentId: current.id,
      messages,
      me,
      focus: true,
    })
  }
}