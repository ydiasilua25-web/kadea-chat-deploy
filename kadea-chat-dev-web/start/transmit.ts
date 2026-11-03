import transmit from '@adonisjs/transmit/services/main'

/**
 * Chaque utilisateur ne peut écouter que son propre canal.
 */
transmit.authorize<{ id: string }>('users/:id', (ctx, { id }) => {
  return ctx.auth.user?.id === Number(id)
})

/**
 * Journal de débogage (à retirer plus tard).
 */
transmit.on('subscribe', ({ channel }) => {
  console.log(`[transmit] abonnement au canal ${channel}`)
})