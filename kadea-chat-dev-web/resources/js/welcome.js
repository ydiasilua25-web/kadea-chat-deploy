const root = document.getElementById('welcome')

if (root) {
  const chars = Array.from(root.dataset.text)
  const typed = document.getElementById('typed')
  const caret = document.getElementById('caret')
  const hint = document.getElementById('hint')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let leaving = false

  /** Passer à la messagerie : touche du clavier ou toucher de l'écran. */
  function leave() {
    if (leaving) return
    leaving = true
    window.location.assign('/chat')
  }
  window.addEventListener('keydown', leave)
  window.addEventListener('pointerdown', leave)

  setTimeout(() => hint?.classList.remove('opacity-0'), 600)

  if (reduceMotion) {
    typed.textContent = chars.join('')
    caret?.remove()
    setTimeout(leave, 3000)
  } else {
    let index = 0
    const timer = setInterval(() => {
      index += 1
      typed.textContent = chars.slice(0, index).join('')
      if (index >= chars.length) {
        clearInterval(timer)
        caret?.remove()
        setTimeout(leave, 2500)
      }
    }, 70)
  }
}