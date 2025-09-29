let express = require('express')

let app = express()

let httpServer = require('http').createServer(app)
let io = require('socket.io')(httpServer)


io.on('connection', (socket) => {
  console.log(`${socket.id} connected`)

  socket.on('join', ({ room }, ack) => {
    if (!room || typeof room !== 'string') {
      if (ack) ack({ ok: false })
      return
    }
    socket.join(room)
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
    rooms.forEach(room => socket.to(room).emit('shape', msg))
  })

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`)
  })
})


app.use(express.static('public'));

let PORT = process.env.PORT || 8080
httpServer.listen(PORT, () => console.log(`Server started on port ${PORT}`));