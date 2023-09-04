import app from './upload-server'
import http from 'http'

const server = http.createServer(app)

server.listen(3000, () => {
  console.log('Server listening on port 3000')
})
