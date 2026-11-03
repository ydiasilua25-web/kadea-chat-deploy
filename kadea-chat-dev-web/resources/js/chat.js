import { Transmit } from '@adonisjs/transmit-client'

const aside = document.querySelector('[data-chat-me]')

if (aside) {
  const me = aside.dataset.chatMe
  const box = document.getElementById('messages')
  const conversationId = box ? box.dataset.conversationId : null
  let refreshTimer = null

  /** Recharge la colonne des conversations (aperçu, heure, ordre). */
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

  /** Ajoute un message (HTML fourni par le serveur) ou remplace celui qui existe déjà. */
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
      if (nearBottom) box.scrollTop = box.scrollHeight
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

  /** Connexion temps réel : un canal privé par utilisateur. */
  const transmit = new Transmit({ baseUrl: window.location.origin })
  const subscription = transmit.subscription(`users/${me}`)
  subscription.create()

  subscription.onMessage((event) => {
    refreshList()
    if (conversationId && String(event.conversationId) === conversationId) {
      loadMessage(event.messageId)
    }
  })

  /** Envoi et suppression sans recharger la page (retombe sur l'envoi classique si besoin). */
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
        form.reset()
        form.querySelector('input[name="content"]')?.focus()
      }
      refreshList()
    } catch {
      form.submit()
    } finally {
      button?.removeAttribute('disabled')
    }
  })
}

/** Fenêtre « nouvelle conversation » : liste de tous les utilisateurs, filtrée à la frappe. */
const dialog = document.getElementById('new-chat')

if (dialog) {
  const results = dialog.querySelector('[data-user-results]')
  const input = dialog.querySelector('[data-user-search]')
  const noResult = dialog.querySelector('[data-no-result]')
  let loaded = false

  const normalize = (text) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

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

  async function loadUsers() {
    if (loaded) return
    try {
      const response = await fetch('/chat/users', { headers: { 'X-Requested-With': 'fetch' } })
      if (!response.ok) throw new Error('Chargement impossible')
      results.innerHTML = await response.text()
      loaded = true
      filter()
    } catch {
      results.textContent = 'Impossible de charger les utilisateurs. Réessaie.'
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-new-chat]')) {
      event.preventDefault()
      dialog.showModal()
      loadUsers()
      input.focus()
      return
    }
    if (event.target.closest('[data-close-new-chat]') || event.target === dialog) {
      dialog.close()
    }
  })

  input.addEventListener('input', filter)
  dialog.addEventListener('close', () => {
    input.value = ''
    filter()
  })
}