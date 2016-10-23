import express from 'express'
import fs from 'fs'
import pg from './pg'

const router = express.Router()

let server_keys = []
let server_map = {}

const params_to_db = ({host,port,db,username}) => `${username}@${host}:${port}/${db}`

const query = (params) => {
  const server = pg(server_map[params_to_db(params)])

  return server(params.database ? params.database : params.db)
}

router.get('/servers', (req, res) => {
  const slurped = fs.readFileSync('servers.json')
  const list = JSON.parse(slurped)

  list.forEach(server => {
    server_keys.push(params_to_db(server))
    server_map[params_to_db(server)] = server
  })

  res.send(list)
})

const prefix = '/:username/:host/:port/:db'

const table = (t, req) => t.one(`
  SELECT c.oid,
    n.nspname,
    c.relname
  FROM pg_catalog.pg_class c
       LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname ~ $/table/
    AND n.nspname ~ $/schema/
  ORDER BY 2, 3
`, {
  table: `^(${req.params.table})$`,
  schema: `^(${req.params.schema})$`
})

const routes = [
  {
    path: `${prefix}/databases`,
    query: req => query(req.params).any(`
      SELECT
        *
      FROM pg_database
      WHERE
        NOT datistemplate ORDER BY datname
    `)
  },
  {
    path: `${prefix}/tablespaces`,
    query: req => query(req.params).any(`
      SELECT
        *
      FROM pg_tablespace
      ORDER BY spcname
    `)
  },
  {
    path: `${prefix}/roles`,
    query: req => query(req.params).any(`
      SELECT
        *
      FROM pg_roles
      ORDER BY rolname
    `)
  },
  {
    path: `${prefix}/databases/:database/schemas`,
    query: req => query(req.params).any(`
      SELECT
        *
      FROM pg_namespace
      WHERE
        nspname !~ '^pg_'
        AND nspname <> 'information_schema'
      ORDER BY nspname
    `)
  },
  {
    path: `${prefix}/databases/:database/schemas/:schema/tables`,
    query: req => query(req.params).any(`
      SELECT * FROM pg_tables WHERE schemaname = $/schema/ ORDER BY tablename
    `, { schema: req.params.schema })
  },
  {
    path: `${prefix}/databases/:database/schemas/:schema/tables/:table/columns`,
    query: req => query(req.params).task(t => table(t, req)
      .then(table => t.any(`
        SELECT a.attname,
          pg_catalog.format_type(a.atttypid, a.atttypmod),
          (
            SELECT
              substring(pg_catalog.pg_get_expr(d.adbin, d.adrelid) for 128)
            FROM pg_catalog.pg_attrdef d
            WHERE
              d.adrelid = a.attrelid
              AND d.adnum = a.attnum
              AND a.atthasdef
          ),
          a.attnotnull,
          a.attnum,
          (
            SELECT
              c.collname
            FROM pg_catalog.pg_collation c, pg_catalog.pg_type t
            WHERE
              c.oid = a.attcollation
              AND t.oid = a.atttypid
              AND a.attcollation <> t.typcollation
          ) AS attcollation
        FROM pg_catalog.pg_attribute a
        WHERE
          a.attrelid = $/oid/
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
      `, table)
    ))
  },
  {
    path: `${prefix}/databases/:database/schemas/:schema/tables/:table/indexes`,
    query: req => query(req.params).task(t => table(t, req)
      .then(table => t.any(`
        SELECT
          c2.relname,
          i.indisprimary,
          i.indisunique,
          i.indisclustered,
          i.indisvalid,
          pg_catalog.pg_get_indexdef(i.indexrelid, 0, true),
          pg_catalog.pg_get_constraintdef(con.oid, true),
          contype,
          condeferrable,
          condeferred,
          c2.reltablespace
        FROM
          pg_catalog.pg_class c,
          pg_catalog.pg_class c2,
          pg_catalog.pg_index i
          LEFT JOIN pg_catalog.pg_constraint con ON (
            conrelid = i.indrelid
            AND conindid = i.indexrelid
            AND contype IN ('p','u','x')
          )
        WHERE
          c.oid = $/oid/
          AND c.oid = i.indrelid
          AND i.indexrelid = c2.oid
        ORDER BY
          i.indisprimary DESC,
          i.indisunique DESC,
          c2.relname
      `, table
      )
    ))
  },
  {
    path: `${prefix}/databases/:database/schemas/:schema/tables/:table/constraints`,
    query: req => query(req.params).task(t => table(t, req)
      .then(table => t.any(`
        SELECT
          conname,
          pg_catalog.pg_get_constraintdef(r.oid, true) as condef
        FROM pg_catalog.pg_constraint r
        WHERE
          r.conrelid = $/oid/
          AND r.contype = 'f'
        ORDER BY 1
      `, table)
    ))
  }
]

routes.forEach( route => {
  router.get(route.path, async (req, res) => {
    let result

    try {
      result = await route.query(req)
    } catch(e) {
      return res.send(e)
    }

    res.send(result)
  })
})

export default router
