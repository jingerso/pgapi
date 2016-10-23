const options = {
  pgNative: false,
  capSQL: true
}

const pgp = require('pg-promise')(options)
const monitor = require('pg-monitor')

monitor.attach(options)

let conn = {}

export default ({username, host, port, password, db}) => {
  const key = `postgres://${username}:${password}@{host}:${port}/${db}`

  if (conn[key]) return conn[key]

  conn[key] = pgp({
    host,
    port,
    database: db,
    user: username,
    password,
    poolSize: 10
  })

  return conn[key]
}
