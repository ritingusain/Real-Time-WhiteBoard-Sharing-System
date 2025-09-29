let express = require('express')

let app = express()

let httpServer = require('http').createServer(app)
let io = require('socket.io')(httpServer)


io.on('connection', (socket) => {
  console.log(`${socket.id} connected`)
  // in-memory history per room
  // structure: { strokes: [{ path, color, width }], shapes: [{...}], clears: number }
  if (!io.history) io.history = new Map()

  socket.on('join', ({ room }, ack) => {
    if (!room || typeof room !== 'string') {
      if (ack) ack({ ok: false })
      return
    }
    const valid = /^[a-z0-9-]{4,24}$/i.test(room)
    if (!valid) {
      if (ack) ack({ ok: false, error: 'invalid_room' })
      return
    }
    socket.join(room)
    if (!io.history.has(room)) io.history.set(room, { strokes: [], shapes: [], clears: 0 })
    const state = io.history.get(room)
    socket.emit('init', state)
    if (ack) ack({ ok: true })
  })

  socket.on('draw', (data) => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id)
    rooms.forEach(room => socket.to(room).emit('ondraw', { x: data.x, y: data.y }))
  })

  socket.on('down', (data) => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id)
    rooms.forEach(room => socket.to(room).emit('ondown', { x: data.x, y: data.y }))
  })

  socket.on('shape', (msg) => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id)
    rooms.forEach(room => {
      const state = io.history.get(room)
      if (state) state.shapes.push(msg)
      socket.to(room).emit('shape', msg)
    })
  })

  // Persist finished pencil strokes for late joiners
  socket.on('stroke', (msg) => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id)
    rooms.forEach(room => {
      const state = io.history.get(room)
      if (state) state.strokes.push(msg)
      // no broadcast needed; realtime was already shown via draw/down
    })
  })

  socket.on('clear', () => {
    const rooms = [...socket.rooms].filter(r => r !== socket.id)
    rooms.forEach(room => {
      const state = io.history.get(room)
      if (state) {
        state.strokes = []
        state.shapes = []
        state.clears += 1
      }
      io.to(room).emit('clear')
    })
  })

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`)
  })
})


app.use(express.static('public'));

let PORT = process.env.PORT || 8080
httpServer.listen(PORT, () => console.log(`Server started on port ${PORT}`));