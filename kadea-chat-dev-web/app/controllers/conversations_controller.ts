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
    return view.render('pages/chat/index', { conversations, currentId: null, focus: false, me })
  }

  /** Seulement la liste, en HTML : sert à la mettre à jour en temps réel. */
  async list({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const conversations = await new ConversationService().listFor(me)
    const currentId = Number(request.input('current')) || null
    return view.render('partials/chat/conversation_list', { conversations, currentId })
  }

  /** Page de secours (sans JavaScript) : tous les utilisateurs, avec recherche. */
  async create({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const term = String(request.input('q', '')).trim()

    const [conversations, users] = await Promise.all([
      service.listFor(me),
      service.listUsers(me, term),
    ])

    return view.render('pages/chat/new', {
      conversations,
      users,
      term,
      currentId: null,
      focus: true,
      me,
    })
  }

  /** La liste des utilisateurs en HTML (simple liste, ou cases à cocher pour un groupe). */
  async users({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const users = await new ConversationService().listUsers(me)
    const template =
      request.input('select') === '1' ? 'partials/chat/user_checklist' : 'partials/chat/user_list'
    return view.render(template, { users })
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

  /** Une discussion ouverte, avec ses messages (et les infos du groupe si c'en est un). */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()

    const conversation = await service.findForMember(me, params.id)
    const [conversations, messages] = await Promise.all([
      service.listFor(me),
      service.messagesOf(conversation, me),
    ])
    const current = conversations.find((item) => item.id === conversation.id)!

    const members = current.isGroup ? await service.membersOf(conversation) : []
    const iAmAdmin = current.isGroup ? await service.isAdmin(me, conversation) : false
    const candidates =
      current.isGroup && iAmAdmin ? await service.candidatesFor(conversation) : []

    const rendered = await Promise.all(
      messages.map((message) =>
        view.render('partials/chat/message', { message, me, isGroup: current.isGroup })
      )
    )

    return view.render('pages/chat/show', {
      conversations,
      current,
      currentId: current.id,
      messagesHtml: rendered.join(''),
      hasMessages: messages.length > 0,
      members,
      iAmAdmin,
      candidates,
      me,
      focus: true,
    })
  }
}