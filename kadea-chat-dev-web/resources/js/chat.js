import { Transmit } from '@adonisjs/transmit-client'

const COARSE = window.matchMedia('(pointer: coarse)').matches
const LONG_PRESS_MS = 2000 // appui long sur téléphone : 2 secondes
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const DOC_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']
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
    'fixed bottom-24 left-1/2 z-[60] w-max max-w-[90vw] -translate-x-1/2 rounded-2xl bg-pine px-5 py-2.5 text-center text-sm text-pine-fg shadow-lg md:bottom-10'
  document.body.append(toast)
  setTimeout(() => toast.remove(), 3500)
}

/** Texte d'erreur lisible pour une réponse refusée par le serveur. */
async function errorText(response) {
  const type = response.headers.get('content-type') || ''
  if (type.includes('text/plain')) {
    const text = (await response.text()).trim()
    if (text) return text.slice(0, 220)
  }
  return `Action refusée (code ${response.status}). Recharge la page si le problème continue.`
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

/* ---------- Fenêtres de choix d'utilisateurs (conversation, groupe) ---------- */
const normalize = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function setupUserDialog(dialog, url) {
  if (!dialog) return null
  const results = dialog.querySelector('[data-user-results]')
  const input = dialog.querySelector('[data-user-search]')
  const noResult = dialog.querySelector('[data-no-result]')
  let loaded = false

  function filter() {
    const term = normalize(input.value.trim())
    let visible = 0
    results.querySelectorAll('[data-user]').forEach((row) => {
      const match = normalize(row.dataset.search).includes(term)
      row.style.display = match ? '' : 'none'
      if (match) visible++
    })
    noResult.style.display = loaded && visible === 0 ? 'block' : 'none'
    results.scrollTop = 0
  }

  async function load() {
    if (loaded) return
    try {
      const response = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } })
      if (!response.ok) throw new Error('Chargement impossible')
      results.innerHTML = await response.text()
      loaded = true
      filter()
    } catch {
      results.textContent = 'Impossible de charger les utilisateurs. Réessaie.'
    }
  }

  input.addEventListener('input', filter)
  dialog.addEventListener('close', () => {
    input.value = ''
    dialog.querySelector('form[data-reset]')?.reset()
    filter()
  })

  return { load }
}

const newChatUsers = setupUserDialog(document.getElementById('new-chat'), '/chat/users')
const newGroupUsers = setupUserDialog(document.getElementById('new-group'), '/chat/users?select=1')

function openDialog(id) {
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close())
  const dialog = document.getElementById(id)
  if (dialog) dialog.showModal()
  return dialog
}

/* ---------- Boutons généraux (toutes les pages de chat) ---------- */
document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  const emoji = target.closest('[data-emoji]')
  if (emoji) {
    const input = document.querySelector('form[data-composer] input[name="content"]')
    if (input) {
      input.setRangeText(emoji.dataset.emoji, input.selectionStart, input.selectionEnd, 'end')
      input.focus()
    }
    return
  }

  if (target.closest('[data-open-new-chat]') && newChatUsers) {
    event.preventDefault()
    openDialog('new-chat')
    newChatUsers.load()
    document.querySelector('#new-chat [data-user-search]')?.focus()
    return
  }

  if (target.closest('[data-open-new-group]') && newGroupUsers) {
    event.preventDefault()
    openDialog('new-group')
    newGroupUsers.load()
    document.querySelector('#new-group input[name="name"]')?.focus()
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

  // Joindre un fichier : ouvre le sélecteur de fichiers du navigateur.
  const pick = target.closest('[data-pick]')
  if (pick) {
    const input = document.querySelector('[data-file-input]')
    if (input) {
      input.accept = pick.dataset.accept || ''
      input.click()
    }
    closePanels()
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

/* ---------- Recherche dans la liste des conversations ---------- */
function applyConversationFilter() {
  const input = document.querySelector('[data-conversation-search]')
  const list = document.getElementById('conversation-list')
  if (!input || !list) return

  const term = normalize(input.value.trim())
  let visible = 0
  list.querySelectorAll('[data-conv]').forEach((row) => {
    const match = normalize(row.dataset.search).includes(term)
    row.style.display = match ? '' : 'none'
    if (match) visible++
  })

  const empty = document.querySelector('[data-conversation-empty]')
  if (empty) empty.style.display = term !== '' && visible === 0 ? 'block' : 'none'
}

document.addEventListener('input', (event) => {
  if (event.target instanceof Element && event.target.matches('[data-conversation-search]')) {
    applyConversationFilter()
  }
})

/* ---------- Page de chat : temps réel, envoi, fichiers, menu des messages ---------- */
const aside = document.querySelector('[data-chat-me]')

if (aside) {
  const me = aside.dataset.chatMe
  const box = document.getElementById('messages')
  const conversationId = box ? box.dataset.conversationId : null
  const composer = document.querySelector('form[data-composer]')
  const field = composer?.querySelector('input[name="content"]')
  const banner = composer?.querySelector('[data-edit-banner]')
  const fileInput = composer?.querySelector('[data-file-input]')
  const chip = composer?.querySelector('[data-file-chip]')
  const menu = document.getElementById('message-menu')
  let refreshTimer = null
  let readTimer = null
  let pressTimer = null
  let menuTarget = null
  let editing = false

  const csrfToken = () => document.querySelector('input[name="_csrf"]')?.value ?? ''

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
        if (response.ok) {
          list.innerHTML = await response.text()
          applyConversationFilter()
        }
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

  /** Met à jour les coches (envoyé, reçu, lu) des messages que j'ai envoyés. */
  async function refreshStatuses() {
    if (!conversationId || !box) return
    try {
      const response = await fetch(`/chat/${conversationId}/status`, {
        headers: { 'X-Requested-With': 'fetch', Accept: 'application/json' },
      })
      if (!response.ok) return
      const { minDelivered, minRead } = await response.json()

      box.querySelectorAll('[data-own="1"][data-message-id]').forEach((wrapper) => {
        const status = wrapper.querySelector('[data-status]')
        if (!status) return
        const id = Number(wrapper.dataset.messageId)
        status.dataset.state = id <= minRead ? 'read' : id <= minDelivered ? 'delivered' : 'sent'
      })
    } catch {
      /* ignoré */
    }
  }

  /** Dit au serveur que la conversation ouverte a été lue (seulement si l'onglet est visible). */
  function markRead() {
    if (!conversationId || document.visibilityState !== 'visible') return
    clearTimeout(readTimer)
    readTimer = setTimeout(() => {
      post(`/chat/${conversationId}/read`).catch(() => {})
    }, 300)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markRead()
      refreshStatuses()
    }
  })

  /* --- Temps réel : un canal privé par utilisateur --- */
  const transmit = new Transmit({ baseUrl: window.location.origin })
  const subscription = transmit.subscription(`users/${me}`)
  subscription.create()

  subscription.onMessage((event) => {
    refreshList()
    if (!conversationId || String(event.conversationId) !== conversationId) return

    // Retiré du groupe pendant qu'on le consulte : retour à la liste.
    if (event.removed) {
      window.location.assign('/chat')
      return
    }
    // Un marque-page « reçu » ou « lu » a avancé : on met les coches à jour.
    if (event.status) {
      refreshStatuses()
      return
    }
    if (event.messageId) {
      loadMessage(event.messageId).then(markRead)
    }
  })

  /* --- Fichier joint --- */
  function clearFile() {
    if (fileInput) fileInput.value = ''
    if (chip) chip.style.display = 'none'
  }

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) {
      clearFile()
      return
    }

    const extension = (file.name.split('.').pop() || '').toLowerCase()
    const isImage = IMAGE_EXT.includes(extension)

    if (!isImage && !DOC_EXT.includes(extension)) {
      clearFile()
      showToast('Type de fichier non autorisé.')
      return
    }
    if (file.size > (isImage ? 5 : 10) * 1024 * 1024) {
      clearFile()
      showToast(`Fichier trop lourd : ${isImage ? '5' : '10'} Mo maximum.`)
      return
    }
    if (editing) {
      clearFile()
      showToast('Termine ou annule la modification avant de joindre un fichier.')
      return
    }

    chip.querySelector('[data-file-name]').textContent = file.name
    chip.style.display = 'flex'
    field?.focus()
  })

  chip?.querySelector('[data-file-clear]')?.addEventListener('click', clearFile)

  /* --- Mode « modification » du champ d'écriture --- */
  function exitEdit() {
    if (!composer) return
    editing = false
    composer.action = composer.dataset.defaultAction
    composer.reset()
    clearFile()
    if (banner) banner.style.display = 'none'
  }

  function startEdit(wrapper) {
    if (!composer || !field) return
    const bubble = wrapper.querySelector('[data-bubble]')
    editing = true
    clearFile()
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

    const isComposer = form.hasAttribute('data-composer')
    const hasFile = Boolean(fileInput?.files?.length)
    if (isComposer && !field.value.trim() && !hasFile) return

    const button = form.querySelector('button[type="submit"]')
    button?.setAttribute('disabled', '')
    if (hasFile) showToast('Envoi du fichier…')

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'X-Requested-With': 'fetch' },
      })

      if (response.status >= 400 && response.status < 500) {
        showToast(await errorText(response))
        return
      }
      if (!response.ok) throw new Error('Envoi impossible')

      upsert(await response.text())
      if (isComposer) {
        exitEdit()
        closePanels()
        field?.focus()
        scrollToBottom()
      }
      refreshList()
    } catch {
      if (hasFile) {
        showToast("Envoi impossible. Vérifie ta connexion et réessaie.")
      } else {
        form.submit()
      }
    } finally {
      button?.removeAttribute('disabled')
    }
  })

  /* --- Menu des messages : clic (ordinateur), appui long de 2 s ou bouton « … » (téléphone) --- */
  function closeMenu() {
    if (menu) menu.style.display = 'none'
    menuTarget = null
  }

  function openMenu(wrapper, x, y) {
    if (!menu || !wrapper) return
    menuTarget = wrapper
    const own = wrapper.dataset.own === '1'
    const deleted = wrapper.dataset.deleted === '1'
    const hasText = wrapper.dataset.hasText === '1'
    const show = (name, visible) => {
      const item = menu.querySelector(`[data-action="${name}"]`)
      if (item) item.style.display = visible ? 'flex' : 'none'
    }
    show('edit', own && !deleted && hasText)
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
      const menuButton = event.target.closest('[data-menu-button]')
      if (menuButton) {
        openMenu(menuButton.closest('[data-message-id]'), event.clientX, event.clientY)
        return
      }
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
      if (
        !menu.contains(event.target) &&
        !event.target.closest('[data-bubble]') &&
        !event.target.closest('[data-menu-button]')
      ) {
        closeMenu()
      }
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
        if (!response.ok) {
          showToast(await errorText(response))
          return
        }
        if (action === 'delete') {
          upsert(await response.text())
        } else {
          wrapper.remove()
        }
        refreshList()
      } catch {
        showToast('Action impossible. Vérifie ta connexion.')
      }
    })
  }

  scrollToBottom()
}