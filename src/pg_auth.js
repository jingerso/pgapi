import pg from './pg'

let server_keys = []
let server_map = {}

const params_to_db = ({host,port,username}) => `${username}@${host}:${port}`

const query = (params) => {
  const server = {...server_map[params_to_db(params)]}
  
  if (params.database) server.db = params.database

  return pg(server)
}

const add = server => {
  server_keys.push(params_to_db(server))
  server_map[params_to_db(server)] = server
}

export default {
  query,
  add,
  server_keys,
  server_map
}
