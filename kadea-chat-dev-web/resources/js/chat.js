import { Transmit } from '@adonisjs/transmit-client'

const COARSE = window.matchMedia('(pointer: coarse)').matches
const LONG_PRESS_MS = 2000 // appui long sur téléphone : 2 secondes
const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤔', '😅',
  '😭', '😡', '😴', '🤗', '😇', '🥳', '😢', '😮', '😉', '🙂',
  '👍', '👎', '👏', '🙏', '💪', '🙌', '🤝', '👋', '🤞', '👀',
  '🔥', '🎉', '❤️', '💯', '✅', '⭐', '🌟', '🚀', '📚', '💻',
]

/* ---------- Petit message temporaire ---------- */
function showToast(text) {
  const toast = document.createElement('div')
  toast.textContent = text
  toast.setAttribute('role', 'status')
  toast.className =
    'fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-pine px-5 py-2.5 text-sm text-pine-fg shadow-lg md:bottom-10'
  document.body.append(toast)
  setTimeout(() => toast.remove(), 2200)
}

/* ---------- Panneaux (emoji, joindre) ---------- */
function closePanels() {
  document.querySelectorAll('[data-panel]').forEach((panel) => (panel.style.display = 'none'))
}

function togglePanel(id) {
  const panel = document.getElementById(id)
  if (!panel) return
  const wasOpen = panel.style.display !== 'none'
  closePanels()
  if (!wasOpen) panel.style.display = 'block'
}

const emojiPanel = document.getElementById('emoji-panel')
if (emojiPanel) {
  const grid = document.createElement('div')
  grid.className = 'grid grid-cols-8 gap-1'
  EMOJIS.forEach((emoji) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.emoji = emoji
    button.textContent = emoji
    button.className = 'grid size-9 place-items-center rounded-lg text-xl hover:bg-panel'
    grid.append(button)
  })
  emojiPanel.append(grid)
}

/* ---------- Fenêtre « nouvelle conversation » ---------- */
const newChat = document.getElementById('new-chat')
let usersLoaded = false

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function filterUsers() {
  if (!newChat) return
  const results = newChat.querySelector('[data-user-results]')
  const input = newChat.querySelector('[data-user-search]')
  const noResult = newChat.querySelector('[data-no-result]')
  const term = normalize(input.value.trim())
  let visible = 0

  results.querySelectorAll('[data-user]').forEach((row) => {
    const match = normalize(row.dataset.search).includes(term)
    row.style.display = match ? '' : 'none'
    if (match) visible++
  })
  noResult.style.display = usersLoaded && visible === 0 ? 'block' : 'none'
  results.scrollTop = 0
}

async function loadUsers() {
  if (usersLoaded || !newChat) return
  const results = newChat.querySelector('[data-user-results]')
  try {
    const response = await fetch('/chat/users', { headers: { 'X-Requested-With': 'fetch' } })
    if (!response.ok) throw new Error('Chargement impossible')
    results.innerHTML = await response.text()
    usersLoaded = true
    filterUsers()
  } catch {
    results.textContent = 'Impossible de charger les utilisateurs. Réessaie.'
  }
}

newChat?.querySelector('[data-user-search]')?.addEventListener('input', filterUsers)
newChat?.addEventListener('close', () => {
  newChat.querySelector('[data-user-search]').value = ''
  filterUsers()
})

function openDialog(id) {
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close())
  const dialog = document.getElementById(id)
  if (dialog) dialog.showModal()
  return dialog
}

/* ---------- Boutons généraux (toutes les pages de chat) ---------- */
document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) {
    if (target instanceof HTMLDialogElement) target.close()
    return
  }

  const emoji = target.closest('[data-emoji]')
  if (emoji) {
    const input = document.querySelector('form[data-composer] input[name="content"]')
    if (input) {
      input.setRangeText(emoji.dataset.emoji, input.selectionStart, input.selectionEnd, 'end')
      input.focus()
    }
    return
  }

  if (target.closest('[data-open-new-chat]') && newChat) {
    event.preventDefault()
    openDialog('new-chat')
    loadUsers()
    newChat.querySelector('[data-user-search]')?.focus()
    return
  }

  const opener = target.closest('[data-open]')
  if (opener) {
    event.preventDefault()
    openDialog(opener.dataset.open)
    return
  }

  if (target.closest('[data-close]')) {
    target.closest('dialog')?.close()
    return
  }

  const soon = target.closest('[data-soon]')
  if (soon) {
    showToast(soon.dataset.soon || 'Bientôt disponible')
    closePanels()
    return
  }

  const toggle = target.closest('[data-toggle]')
  if (toggle) {
    togglePanel(toggle.dataset.toggle)
    return
  }

  if (!target.closest('[data-panel]')) closePanels()
})

// Un clic sur le fond assombri d'une fenêtre la ferme.
document.addEventListener('click', (event) => {
  if (event.target instanceof HTMLDialogElement) event.target.close()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePanels()
})

/* ---------- Page de chat : temps réel, envoi, menu des messages ---------- */
const aside = document.querySelector('[data-chat-me]')

if (aside) {
  const me = aside.dataset.chatMe
  const box = document.getElementById('messages')
  const conversationId = box ? box.dataset.conversationId : null
  const composer = document.querySelector('form[data-composer]')
  const field = composer?.querySelector('input[name="content"]')
  const banner = composer?.querySelector('[data-edit-banner]')
  const menu = document.getElementById('message-menu')
  let refreshTimer = null
  let pressTimer = null
  let menuTarget = null

  const csrfToken = () => composer?.querySelector('input[name="_csrf"]')?.value ?? ''

  function post(url) {
    const data = new FormData()
    data.append('_csrf', csrfToken())
    return fetch(url, { method: 'POST', body: data, headers: { 'X-Requested-With': 'fetch' } })
  }

  /** Recharge la colonne des conversations. */
  function refreshList() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(async () => {
      const list = document.getElementById('conversation-list')
      if (!list) return
      try {
        const response = await fetch(`/chat/list?current=${conversationId ?? ''}`, {
          headers: { 'X-Requested-With': 'fetch' },
        })
        if (response.ok) list.innerHTML = await response.text()
      } catch {
        /* réseau coupé : on réessaiera au prochain événement */
      }
    }, 150)
  }

  function scrollToBottom() {
    if (!box) return
    requestAnimationFrame(() => box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }))
  }

  /** Ajoute un message (HTML du serveur) ou remplace celui qui existe déjà. */
  function upsert(html) {
    if (!box) return
    const template = document.createElement('template')
    template.innerHTML = html.trim()
    const element = template.content.firstElementChild
    if (!element || !element.dataset.messageId) return

    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160
    const existing = box.querySelector(`[data-message-id="${element.dataset.messageId}"]`)

    if (existing) {
      existing.replaceWith(element)
    } else {
      box.querySelector('[data-empty]')?.remove()
      box.append(element)
      if (nearBottom || element.dataset.own === '1') scrollToBottom()
    }
  }

  async function loadMessage(id) {
    try {
      const response = await fetch(`/chat/${conversationId}/messages/${id}`, {
        headers: { 'X-Requested-With': 'fetch' },
      })
      if (response.ok) upsert(await response.text())
    } catch {
      /* ignoré */
    }
  }

  /* --- Temps réel : un canal privé par utilisateur --- */
  const transmit = new Transmit({ baseUrl: window.location.origin })
  const subscription = transmit.subscription(`users/${me}`)
  subscription.create()

  subscription.onMessage((event) => {
    refreshList()
    if (conversationId && String(event.conversationId) === conversationId) {
      loadMessage(event.messageId)
    }
  })

  /* --- Mode « modification » du champ d'écriture --- */
  function exitEdit() {
    if (!composer) return
    composer.action = composer.dataset.defaultAction
    composer.reset()
    if (banner) banner.style.display = 'none'
  }

  function startEdit(wrapper) {
    if (!composer || !field) return
    const bubble = wrapper.querySelector('[data-bubble]')
    composer.action = `/chat/${conversationId}/messages/${wrapper.dataset.messageId}/edit`
    field.value = bubble ? bubble.textContent.trim() : ''
    if (banner) banner.style.display = 'flex'
    field.focus()
  }

  banner?.querySelector('[data-cancel-edit]')?.addEventListener('click', exitEdit)

  /* --- Envoi sans recharger la page --- */
  document.addEventListener('submit', async (submitEvent) => {
    const form = submitEvent.target
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-fetch')) return
    submitEvent.preventDefault()

    const button = form.querySelector('button[type="submit"]')
    button?.setAttribute('disabled', '')

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'X-Requested-With': 'fetch' },
      })
      if (!response.ok) throw new Error('Envoi impossible')

      upsert(await response.text())
      if (form.hasAttribute('data-composer')) {
        exitEdit()
        closePanels()
        field?.focus()
        scrollToBottom()
      }
      refreshList()
    } catch {
      form.submit()
    } finally {
      button?.removeAttribute('disabled')
    }
  })

  /* --- Menu des messages : clic (ordinateur) ou appui long de 2 s (téléphone) --- */
  function closeMenu() {
    if (menu) menu.style.display = 'none'
    menuTarget = null
  }

  function openMenu(wrapper, x, y) {
    if (!menu || !wrapper) return
    menuTarget = wrapper
    const own = wrapper.dataset.own === '1'
    const deleted = wrapper.dataset.deleted === '1'
    const show = (name, visible) => {
      const item = menu.querySelector(`[data-action="${name}"]`)
      if (item) item.style.display = visible ? 'flex' : 'none'
    }
    show('edit', own && !deleted)
    show('delete', own && !deleted)
    show('hide', true)

    Object.assign(menu.style, { display: 'block', left: '0px', top: '0px', right: 'auto', bottom: 'auto', width: '' })

    if (window.matchMedia('(max-width: 767px)').matches) {
      Object.assign(menu.style, { left: '12px', right: '12px', top: 'auto', bottom: '12px', width: 'auto' })
    } else {
      const rect = menu.getBoundingClientRect()
      menu.style.left = `${Math.max(12, Math.min(x, window.innerWidth - rect.width - 12))}px`
      menu.style.top = `${Math.max(12, Math.min(y, window.innerHeight - rect.height - 12))}px`
    }
  }

  if (box && menu) {
    box.addEventListener('click', (event) => {
      if (COARSE) return
      const bubble = event.target.closest('[data-bubble]')
      if (!bubble) return
      openMenu(bubble.closest('[data-message-id]'), event.clientX, event.clientY)
    })

    if (COARSE) {
      box.addEventListener(
        'touchstart',
        (event) => {
          const bubble = event.target.closest('[data-bubble]')
          if (!bubble) return
          const touch = event.touches[0]
          clearTimeout(pressTimer)
          pressTimer = setTimeout(() => {
            navigator.vibrate?.(20)
            openMenu(bubble.closest('[data-message-id]'), touch.clientX, touch.clientY)
          }, LONG_PRESS_MS)
        },
        { passive: true }
      )
      const cancelPress = () => clearTimeout(pressTimer)
      box.addEventListener('touchend', cancelPress)
      box.addEventListener('touchmove', cancelPress, { passive: true })
      box.addEventListener('touchcancel', cancelPress)
      box.addEventListener('contextmenu', (event) => {
        if (event.target.closest('[data-bubble]')) event.preventDefault()
      })
    }

    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && !event.target.closest('[data-bubble]')) closeMenu()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu()
    })

    menu.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]')
      if (!button || !menuTarget) return

      const wrapper = menuTarget
      const action = button.dataset.action
      closeMenu()

      if (action === 'edit') {
        startEdit(wrapper)
        return
      }

      const url = `/chat/${conversationId}/messages/${wrapper.dataset.messageId}/${action}`
      try {
        const response = await post(url)
        if (!response.ok) throw new Error('Action impossible')
        if (action === 'delete') {
          upsert(await response.text())
        } else {
          wrapper.remove()
        }
        refreshList()
      } catch {
        showToast('Action impossible. Réessaie.')
      }
    })
  }

  scrollToBottom()
}