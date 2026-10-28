function initSphere(canvas) {
  const ctx = canvas.getContext('2d')
  const root = document.documentElement
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const COUNT = 2600
  const golden = Math.PI * (3 - Math.sqrt(5))
  const jitter = () => (Math.random() - 0.5) * 0.05
  const points = Array.from({ length: COUNT }, (_, i) => {
    const y = 1 - (i / (COUNT - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const a = golden * i
    return { x: Math.cos(a) * r + jitter(), y: y + jitter(), z: Math.sin(a) * r + jitter(), tone: Math.random() }
  })

  const BASE_SPEED = reduceMotion ? 0 : 0.0025
  let rotY = 0
  let rotX = -0.2
  let velocity = BASE_SPEED
  let dragging = false
  let lastX = 0
  let lastY = 0
  let visible = true
  let colors = readColors()

  function readColors() {
    const styles = getComputedStyle(root)
    return {
      accent: styles.getPropertyValue('--accent').trim() || '#17a58d',
      grey: styles.getPropertyValue('--subtle').trim() || '#8f8f89',
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    draw()
  }

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const radius = Math.min(cx, cy) * 0.82
    const cosY = Math.cos(rotY)
    const sinY = Math.sin(rotY)
    const cosX = Math.cos(rotX)
    const sinX = Math.sin(rotX)

    for (const p of points) {
      const x1 = p.x * cosY + p.z * sinY
      const z1 = -p.x * sinY + p.z * cosY
      const y1 = p.y * cosX - z1 * sinX
      const z2 = p.y * sinX + z1 * cosX
      const depth = (z2 + 1) / 2
      const k = 2.4 / (2.4 - z2)
      ctx.globalAlpha = 0.18 + depth * 0.82
      ctx.fillStyle = p.tone < 0.62 ? colors.accent : colors.grey
      const size = (0.7 + depth * 1.5) * dpr
      ctx.fillRect(cx + x1 * radius * k, cy + y1 * radius * k, size, size)
    }
    ctx.globalAlpha = 1
  }

  function frame() {
    if (visible && !reduceMotion) {
      if (!dragging) {
        rotY += velocity
        velocity += (BASE_SPEED - velocity) * 0.04
      }
      draw()
    }
    requestAnimationFrame(frame)
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    rotY += dx * 0.006
    rotX = Math.max(-1, Math.min(1, rotX + dy * 0.006))
    velocity = dx * 0.006
    if (reduceMotion) draw()
  })
  const stop = () => (dragging = false)
  canvas.addEventListener('pointerup', stop)
  canvas.addEventListener('pointercancel', stop)

  new ResizeObserver(resize).observe(canvas)
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(canvas)
  new MutationObserver(() => {
    colors = readColors()
    draw()
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] })

  resize()
  requestAnimationFrame(frame)
}

document.querySelectorAll('canvas[data-sphere]').forEach(initSphere)