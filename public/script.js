let canvas = document.getElementById("canvas")
let login = document.getElementById("login")
let form = document.getElementById("room-form")
let roomInput = document.getElementById("room")
let generateBtn = document.getElementById("generate")
let toolbar = document.getElementById("toolbar")
let toolPencil = document.getElementById("tool-pencil")
let toolLine = document.getElementById("tool-line")
let toolRect = document.getElementById("tool-rect")
let toolCircle = document.getElementById("tool-circle")
let colorInput = document.getElementById("color")
let widthInput = document.getElementById("width")
let clearBtn = document.getElementById("clear")
let themeBtn = document.getElementById("theme")

let ctx = canvas.getContext("2d")

let socket;
let joined = false;
let x;
let y;
let mouseDown = false;
let startX;
let startY;
let tool = 'pencil';
let theme = 'dark';
let snapshot = null;
let rAF = null;
let batch = [];

function resizeCanvas() {
  canvas.width = 0.98 * window.innerWidth
  canvas.height = window.innerHeight
}

window.addEventListener('resize', resizeCanvas)

generateBtn.onclick = () => {
  const key = `room-${Math.random().toString(36).slice(2, 8)}`
  roomInput.value = key
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const room = roomInput.value.trim()
  if (!room) return

  // connect same-origin
  socket = io()

  socket.emit('join', { room }, (ack) => {
    if (ack && ack.ok) {
      joined = true
      login.classList.add('d-none')
      canvas.classList.remove('d-none')
      toolbar.classList.remove('d-none')
      toolbar.classList.add('d-flex')
      resizeCanvas()
      applyTheme()
    }
  })

  socket.on('ondraw', ({ x, y }) => {
    ctx.lineTo(x, y)
    ctx.stroke()
  })

  socket.on('ondown', ({ x, y }) => {
    ctx.moveTo(x, y)
  })

  socket.on('shape', (msg) => {
    drawRemoteShape(msg)
  })

  socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  })

  socket.on('init', (state) => {
    if (!state) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // redraw strokes
    if (Array.isArray(state.strokes)) {
      state.strokes.forEach(stroke => {
        ctx.save()
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = Number(stroke.width)
        ctx.beginPath()
        if (Array.isArray(stroke.path) && stroke.path.length) {
          ctx.moveTo(stroke.path[0].x, stroke.path[0].y)
          for (let i = 1; i < stroke.path.length; i++) {
            ctx.lineTo(stroke.path[i].x, stroke.path[i].y)
          }
          ctx.stroke()
        }
        ctx.restore()
      })
    }
    if (Array.isArray(state.shapes)) {
      state.shapes.forEach(s => drawRemoteShape(s))
    }
  })
})

canvas.onmousedown = (e) => {
  if (!joined) return
  const rect = canvas.getBoundingClientRect()
  x = e.clientX - rect.left
  y = e.clientY - rect.top
  ctx.strokeStyle = colorInput.value
  ctx.fillStyle = colorInput.value
  ctx.lineWidth = Number(widthInput.value)
  startX = x
  startY = y
  if (tool === 'pencil') {
    ctx.beginPath()
    ctx.moveTo(x, y)
    socket.emit('down', { x, y })
  } else {
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
  mouseDown = true
}

canvas.onmouseup = () => {
  if (!joined) return
  if (mouseDown && tool !== 'pencil') {
    const endX = x
    const endY = y
    const msg = { tool, startX, startY, endX, endY, color: colorInput.value, width: Number(widthInput.value) }
    drawRemoteShape(msg)
    socket.emit('shape', msg)
  } else if (mouseDown && tool === 'pencil') {
    // finalize current pencil stroke into history
    socket.emit('stroke', { color: colorInput.value, width: Number(widthInput.value), path: [] })
  }
  mouseDown = false
  snapshot = null
}

canvas.onmouseleave = () => {
  if (!joined) return
  mouseDown = false
}

canvas.onmousemove = (e) => {
  if (!joined) return
  const rect = canvas.getBoundingClientRect()
  x = e.clientX - rect.left
  y = e.clientY - rect.top
  if (!mouseDown) return
  if (tool === 'pencil') {
    // batch points and render at most per frame
    batch.push({ x, y })
    if (!rAF) rAF = requestAnimationFrame(flushBatch)
  } else if (snapshot) {
    ctx.putImageData(snapshot, 0, 0)
    const preview = { tool, startX, startY, endX: x, endY: y, color: colorInput.value, width: Number(widthInput.value) }
    drawRemoteShape(preview)
  }
}

function flushBatch() {
  rAF = null
  if (batch.length === 0) return
  const points = batch
  batch = []
  // draw locally
  for (let i = 0; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  // send last point for realtime others
  const last = points[points.length - 1]
  socket.emit('draw', { x: last.x, y: last.y })
}

toolPencil.onclick = () => setTool('pencil')
toolLine.onclick = () => setTool('line')
toolRect.onclick = () => setTool('rect')
toolCircle.onclick = () => setTool('circle')

clearBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (socket) socket.emit('clear')
}

themeBtn.onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark'
  applyTheme()
}

function setTool(next) {
  tool = next
}

function applyTheme() {
  document.documentElement.setAttribute('data-bs-theme', theme)
  themeBtn.textContent = theme === 'dark' ? 'Dark' : 'Light'
}

function drawRemoteShape(msg) {
  ctx.save()
  ctx.strokeStyle = msg.color
  ctx.fillStyle = msg.color
  ctx.lineWidth = Number(msg.width)
  if (msg.tool === 'line') {
    ctx.beginPath()
    ctx.moveTo(msg.startX, msg.startY)
    ctx.lineTo(msg.endX, msg.endY)
    ctx.stroke()
  } else if (msg.tool === 'rect') {
    const w = msg.endX - msg.startX
    const h = msg.endY - msg.startY
    ctx.strokeRect(msg.startX, msg.startY, w, h)
  } else if (msg.tool === 'circle') {
    const dx = msg.endX - msg.startX
    const dy = msg.endY - msg.startY
    const r = Math.sqrt(dx * dx + dy * dy)
    ctx.beginPath()
    ctx.arc(msg.startX, msg.startY, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// Init sync: receive past state
// strokes: array of { path:[{x,y}], color, width }
// shapes: array of predefined shapes
if (!window._initBound) {
  window._initBound = true
  document.addEventListener('DOMContentLoaded', () => {
    // socket is created on submit; also bind after join below
  })
}

// Bind after join as well
// Insert after join acknowledgment