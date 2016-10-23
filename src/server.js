import "babel-polyfill"
import express from 'express'
import pg_catalog from './pg_catalog'
const app = express()
//app.use(express.static('client/build'))

app.use('/api', pg_catalog)

app.listen(process.env.PORT, () => {
  console.log('Server listening on port %d!', process.env.PORT)
})
