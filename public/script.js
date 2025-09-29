let canvas = document.getElementById("canvas")
let login = document.getElementById("login")
let form = document.getElementById("room-form")
let roomInput = document.getElementById("room")
let generateBtn = document.getElementById("generate")

let ctx = canvas.getContext("2d")

let socket;
let joined = false;
let x;
let y;
let mouseDown = false;

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
      login.style.display = 'none'
      canvas.style.display = 'block'
      resizeCanvas()
    }
  })

  socket.on('ondraw', ({ x, y }) => {
    ctx.lineTo(x, y)
    ctx.stroke()
  })

  socket.on('ondown', ({ x, y }) => {
    ctx.moveTo(x, y)
  })
})

canvas.onmousedown = (e) => {
  if (!joined) return
  x = e.clientX
  y = e.clientY
  ctx.moveTo(x, y)
  socket.emit('down', { x, y })
  mouseDown = true
}

canvas.onmouseup = () => {
  if (!joined) return
  mouseDown = false
}

canvas.onmouseleave = () => {
  if (!joined) return
  mouseDown = false
}

canvas.onmousemove = (e) => {
  if (!joined) return
  x = e.clientX
  y = e.clientY
  if (mouseDown) {
    socket.emit('draw', { x, y })
    ctx.lineTo(x, y)
    ctx.stroke()
  }
}