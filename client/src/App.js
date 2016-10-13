import React, { Component } from 'react';
import fetch from 'isomorphic-fetch';
import server_png from './icons/server.png'
import databases_png from './icons/databases.png'
import database_png from './icons/database.png'
import tablespaces_png from './icons/tablespaces.png'
import tablespace_png from './icons/tablespace.png'
import roles_png from './icons/roles.png'
import role_png from './icons/role.png'
import schemas_png from './icons/schemas.png'
import schema_png from './icons/schema.png'
import tables_png from './icons/tables.png'
import table_png from './icons/table.png'
import extensions_png from './icons/extensions.png'
import extension_png from './icons/extension.png'
import columns_png from './icons/columns.png'
import column_png from './icons/column.png'
import indexes_png from './icons/indexes.png'
import index_png from './icons/index.png'
import constraints_png from './icons/constraints.png'
import foreign_key_png from './icons/foreign_key.png'

import './App.css';

const server_path = ({host,port,username,db}) => `${username}@${host}:${port}/${db}`

const COLLECTIONS = {
  servers: [
    {
      name: 'databases',
      label: 'Databases',
      icon: databases_png,
      item_label_field: 'datname',
      item_icon: database_png
    },
    {
      name: 'tablespaces',
      label: 'Tablespaces',
      icon: tablespaces_png,
      item_label_field: 'spcname',
      item_icon: tablespace_png
    },
    {
      name: 'roles',
      label: 'Roles',
      icon: roles_png,
      item_label_field: 'rolname',
      item_icon: role_png
    }
  ],
  databases: [
    {
      name: 'extensions',
      label: 'Extensions',
      icon: extensions_png,
      item_label_field: 'extname',
      item_icon: extension_png
    },
    {
      name: 'schemas',
      label: 'Schemas',
      icon: schemas_png,
      item_label_field: 'nspname',
      item_icon: schema_png
    }
  ],
  schemas: [
    {
      name: 'tables',
      label: 'Tables',
      icon: tables_png,
      item_label_field: 'tablename',
      item_icon: table_png
    }
  ],
  tables: [
    {
      name: 'columns',
      label: 'Columns',
      icon: columns_png,
      item_label_field: 'attname',
      item_icon: column_png
    },
    {
      name: 'indexes',
      label: 'Indexes',
      icon: indexes_png,
      item_label_field: 'relname',
      item_icon: index_png
    },
    {
      name: 'constraints',
      label: 'Constraints',
      icon: constraints_png,
      item_label_field: 'conname',
      item_icon: foreign_key_png
    }
  ]
}

const Loading = (props) => {
  return (
    <div style={{height:21, display:'flex',flexDirection:'row', alignItems:'center'}}>
      {props.is_last.map((is_last,i) => <span key={i} className={ is_last ? 'verticalLine last' : "verticalLine" }></span>)}
      <i className="material-icons md-18" style={{animation: 'App-logo-spin infinite 1s linear', marginLeft:3,color:'rgba(0,0,0,.54)'}}>autorenew</i>
    </div>
  )
}

const Tree = (props) => {
  let classNames = [
    'dirtree',
    props.is_last[props.is_last.length - 1] ? 'dirtree_elbow' : 'dirtree_tee'
  ]

  if (!props.leaf) classNames.push(props.expanded ? 'dirtree_minus' : 'dirtree_plus')

  return (
    <div>
      <div style={{height:21, display:'flex',flexDirection:'row', alignItems:'center'}}>
        {props.is_last.slice(0, -1).map((is_last,i) => <span key={i} className={ is_last ? 'verticalLine last' : "verticalLine" }></span>)}
        <a href="#" className={classNames.join(' ')} onClick={props.handleToggleTree}>
          {
            props.leaf
            ? <i className="blank"></i>
            : <i className="material-icons md-11">{props.expanded ? 'remove' : 'add'}</i>
          }
        </a>
        <span style={{width:21,height:21,textAlign:'center'}}><img src={props.icon} alt="Server" width="16" height="16" style={{verticalAlign:'middle'}} /></span>
        <span style={{fontSize:12,marginLeft:2}}>
          {props.label}
        </span>
      </div>
      {props.expanded ? props.children : null}
    </div>
  )
}

class App extends Component {
  constructor() {
    super()

    this.state = {
      loading: { servers: true },
      expanded: {},
      remote_ids: {},
      remote_data: {}
    }
  }
  url_for = ([server_id, ...rest]) => {
    const server = this.state.remote_data.servers[server_id]
    let url = [
      server.host,
      server.port,
      server.db,
      server.username,
      ...rest
    ]

    return '/api/' + url.map(u => encodeURIComponent(u)).join('/')
  }
  handleToggleObject = (path) => {
    let expanded = Object.assign({}, this.state.expanded)

    expanded[path] = !expanded[path]
    this.setState({ expanded })
  }
  handleToggleCollection = (ancestors, remote_key_field) => {
    const canonical = ancestors.join('/')
    let expanded = {...this.state.expanded}
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}
    let loading = {...this.state.loading}

    expanded[canonical] = !expanded[canonical]

    loading[canonical] = true
    this.setState({ loading, expanded })

    fetch(this.url_for(ancestors))
      .then(response => response.json())
      .then(json => {
        let ids = json.map(item => item[remote_key_field])
        let data = {}
        json.forEach(item => { data[item[remote_key_field]] = item })

        remote_ids[canonical] = ids
        remote_data[canonical] = data
        loading[canonical] = false

        this.setState({ expanded, remote_ids, remote_data, loading }, () => { console.log(this.state)})
      })
  }
  componentDidMount() {
    fetch('/api/servers')
      .then(response => response.json())
      .then(json => {
        let ids = json.map(server => server_path(server))
        let data = {}
        json.forEach(server => { data[server_path(server)] = server })

        this.setState({
          remote_ids: { servers: ids },
          remote_data: { servers: data },
          loading: { servers: false }
        })
      })
  }
  renderObject = ({config, ...props}) => {
    const ids = this.state.remote_ids[props.key] || []
    if (ids.length) props.label = `${props.label} (${ids.length})`

    if (this.state.loading[props.key]) return <Tree {...props}><Loading {...props}></Loading></Tree>

    return (
      <Tree {...props}>
        {ids.map( (id, i) => {
          const item = this.state.remote_data[props.key][id]
          const ancestors = props.ancestors.concat([item[config.item_label_field]])
          const canonical = ancestors.join('/')

          return this.renderCollection({
            ancestors,
            key: canonical,
            icon: config.item_icon,
            label: item[config.item_label_field],
            expanded: this.state.expanded[canonical],
            handleToggleTree: (e) => { e.preventDefault(); this.handleToggleObject(canonical) },
            is_last: props.is_last.concat([ids.length - 1 === i]),
            collections: COLLECTIONS[config.name] || []
          })
        })}
      </Tree>
    )
  }
  renderCollection = ({collections, ...props}) => {
    return (
      <Tree leaf={!collections.length} {...props}>
        {collections.map( (collection, i) => {
          const ancestors = props.ancestors.concat([collection.name])
          const canonical = ancestors.join('/')

          return this.renderObject({
            ancestors,
            key: canonical,
            icon: collection.icon,
            label: collection.label,
            expanded: this.state.expanded[canonical],
            handleToggleTree: (e) => { e.preventDefault(); this.handleToggleCollection(ancestors, collection.item_label_field) },
            is_last: props.is_last.concat([collections.length - 1 === i]),
            config: collection
          })
        })}
      </Tree>
    )
  }
  render() {
    if (this.state.loading.servers) return <div>Loading...</div>

    const ids = this.state.remote_ids.servers

    return (
      <div className="App">
        {ids.map( (id,i) => {
          const server = this.state.remote_data.servers[id]

          return this.renderCollection({
            key: server_path(server),
            ancestors: [server_path(server)],
            icon: server_png,
            label: `${server.name} (${server.host}:${server.port})`,
            expanded: this.state.expanded[server_path(server)],
            handleToggleTree: () => this.handleToggleObject(server_path(server)),
            is_last: [ids.length - 1 === i],
            collections: COLLECTIONS.servers
          })
        })}
      </div>
    )
  }
}

export default App;
