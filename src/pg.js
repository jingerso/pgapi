const options = {
  pgNative: false,
  capSQL: true
}

const pgp = require('pg-promise')(options)
const monitor = require('pg-monitor')

monitor.attach(options)

let conn = {}

export default function({username, host, port, password}) {
  return (db) => {
    const key = `postgres://${username}@{host}:${port}/${db}`

    if (conn[key]) return conn[key]

    conn[key] = pgp({
      host,
      port,
      database: db,
      user: username,
      password,
      poolSize: 10
    })

    conn[key].one('select 1').then(result => {
      console.log(result)
    })

    return conn[key]
  }
}
