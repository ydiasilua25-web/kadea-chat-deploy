import User from '#models/user'
import ConversationService from '#services/conversation_service'
import BlockService from '#services/block_service'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

const startValidator = vine.create({
  userId: vine.number(),
})

export default class ConversationsController {
  /** Liste des conversations, aucune discussion ouverte. */
  async index({ auth, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    await service.markAllDelivered(me)
    const conversations = await service.listFor(me)
    return view.render('pages/chat/index', { conversations, currentId: null, focus: false, me })
  }

  /** Seulement la liste, en HTML : sert à la mettre à jour en temps réel. */
  async list({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    await service.markAllDelivered(me)
    const conversations = await service.listFor(me)
    const currentId = Number(request.input('current')) || null
    return view.render('partials/chat/conversation_list', { conversations, currentId })
  }

  /** Page de secours (sans JavaScript) : tous les utilisateurs, avec recherche. */
  async create({ auth, request, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const rawTerm = request.input('q')
    const term = typeof rawTerm === 'string' ? rawTerm.trim() : ''

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

  /** Une discussion ouverte : elle est marquée comme lue. */
  async show({ auth, params, view }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()

    const conversation = await service.findForMember(me, params.id)
    await service.markAllDelivered(me)
    await service.markRead(me, conversation)

    const [conversations, messages] = await Promise.all([
      service.listFor(me),
      service.messagesOf(conversation, me),
    ])
    const current = conversations.find((item) => item.id === conversation.id)!

    const peerId = current.isGroup ? null : current.otherUserId
    const blockState = peerId
      ? await new BlockService().state(me, peerId)
      : { iBlocked: false, blockedMe: false }

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
      iBlocked: blockState.iBlocked,
    })
  }

  /** Le navigateur signale que la conversation ouverte a été lue. */
  async read({ auth, params, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)
    await service.markRead(me, conversation)
    return response.noContent()
  }

  /** Les marque-pages « reçu » et « lu » des autres membres (pour les coches). */
  async status({ auth, params, response }: HttpContext) {
    const me = auth.use('web').getUserOrFail()
    const service = new ConversationService()
    const conversation = await service.findForMember(me, params.id)
    return response.json(await service.statusCursors(conversation, me))
  }
}