import express from 'express'
import fs from 'fs'
import pg from './pg_auth'

const router = express.Router()

router.get('/servers', (req, res) => {
  const slurped = fs.readFileSync('servers.json')
  const list = JSON.parse(slurped)

  list.forEach(server => {
    pg.add(server)
  })

  res.send(list.map(({password, ...rest}) => rest))
})

const server_prefix = '/:username/:host/:port'
const db_prefix = `${server_prefix}/databases/:database`

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
    path: `${server_prefix}/databases`,
    query: req => pg.query(req.params).any(`
      SELECT
        *
      FROM pg_database
      WHERE
        NOT datistemplate ORDER BY datname
    `)
  },
  {
    path: `${server_prefix}/tablespaces`,
    query: req => pg.query(req.params).any(`
      SELECT
        *
      FROM pg_tablespace
      ORDER BY spcname
    `)
  },
  {
    path: `${server_prefix}/roles`,
    query: req => pg.query(req.params).any(`
      SELECT
        *
      FROM pg_roles
      ORDER BY rolname
    `)
  },
  {
    path: `${db_prefix}/schemas`,
    query: req => pg.query(req.params).any(`
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
    path: `${db_prefix}/event_triggers`,
    query: req => pg.query(req.params).any(`
      select * from pg_event_trigger
    `)
  },
  {
    path: `${db_prefix}/languages`,
    query: req => pg.query(req.params).any(`
      SELECT l.lanname AS "Name",
             pg_catalog.pg_get_userbyid(l.lanowner) as "Owner",
             l.lanpltrusted AS "Trusted",
             NOT l.lanispl AS "Internal Language",
             l.lanplcallfoid::regprocedure AS "Call Handler",
             l.lanvalidator::regprocedure AS "Validator",
             l.laninline::regprocedure AS "Inline Handler",
             pg_catalog.array_to_string(l.lanacl, E'\n') AS "Access privileges"
      FROM pg_catalog.pg_language l
      WHERE lanplcallfoid != 0
      ORDER BY 1
    `)
  },
  {
    path: `${db_prefix}/extensions`,
    query: req => pg.query(req.params).any(`
      SELECT
        *
      FROM pg_extension
      ORDER BY extname
    `)
  },
  {
    path: `${db_prefix}/foreign_data_wrappers`,
    query: req => pg.query(req.params).any(`
      SELECT fdwname AS "Name",
        pg_catalog.pg_get_userbyid(fdwowner) AS "Owner",
        fdwhandler::pg_catalog.regproc AS "Handler",
        fdwvalidator::pg_catalog.regproc AS "Validator",
        pg_catalog.array_to_string(fdwacl, E'\n') AS "Access privileges",
        fdwoptions AS "Options"
      FROM pg_catalog.pg_foreign_data_wrapper
      ORDER BY 1
    `)
  },
  {
    path: `${db_prefix}/casts`,
    query: req => pg.query(req.params).any(`
      SELECT pg_catalog.format_type(castsource, NULL) AS "Source type",
             pg_catalog.format_type(casttarget, NULL) AS "Target type",
             pg_catalog.format_type(castsource, NULL) || ' -> ' || pg_catalog.format_type(casttarget, NULL) as id,
             CASE WHEN castfunc = 0 THEN '(binary coercible)'
                  ELSE p.proname
             END as "Function",
             CASE WHEN c.castcontext = 'e' THEN 'no'
                  WHEN c.castcontext = 'a' THEN 'in assignment'
                  ELSE 'yes'
             END as "Implicit?"
      FROM pg_catalog.pg_cast c LEFT JOIN pg_catalog.pg_proc p
           ON c.castfunc = p.oid
           LEFT JOIN pg_catalog.pg_type ts
           ON c.castsource = ts.oid
           LEFT JOIN pg_catalog.pg_namespace ns
           ON ns.oid = ts.typnamespace
           LEFT JOIN pg_catalog.pg_type tt
           ON c.casttarget = tt.oid
           LEFT JOIN pg_catalog.pg_namespace nt
           ON nt.oid = tt.typnamespace
      WHERE (true  AND pg_catalog.pg_type_is_visible(ts.oid)
      ) OR (true  AND pg_catalog.pg_type_is_visible(tt.oid)
      )
      ORDER BY 1, 2
    `)
  },
  {
    path: `${db_prefix}/schemas/:schema/collations`,
    query: req => pg.query(req.params).any(`
      SELECT n.nspname AS "Schema",
             c.collname AS "Name",
             c.collcollate AS "Collate",
             c.collctype AS "Ctype",
             pg_catalog.obj_description(c.oid, 'pg_collation') AS "Description"
      FROM pg_catalog.pg_collation c, pg_catalog.pg_namespace n
      WHERE n.oid = c.collnamespace
            AND n.nspname = $/schema/
            AND n.nspname <> 'pg_catalog'
            AND n.nspname <> 'information_schema'
            AND c.collencoding IN (-1, pg_catalog.pg_char_to_encoding(pg_catalog.getdatabaseencoding()))
        AND pg_catalog.pg_collation_is_visible(c.oid)
      ORDER BY 1, 2
    `, { schema: req.params.schema })
  },
  {
    path: `${db_prefix}/schemas/:schema/tables`,
    query: req => pg.query(req.params).any(`
      SELECT * FROM pg_tables WHERE schemaname = $/schema/ ORDER BY tablename
    `, { schema: req.params.schema })
  },
  {
    path: `${db_prefix}/schemas/:schema/tables/:table/columns`,
    query: req => pg.query(req.params).task(t => table(t, req)
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
    path: `${db_prefix}/schemas/:schema/tables/:table/indexes`,
    query: req => pg.query(req.params).task(t => table(t, req)
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
    path: `${db_prefix}/schemas/:schema/tables/:table/constraints`,
    query: req => pg.query(req.params).task(t => table(t, req)
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
