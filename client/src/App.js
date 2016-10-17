import React, { Component } from 'react'
import fetch from 'isomorphic-fetch'
import SplitPane from 'react-split-pane'
import { AutoSizer, List } from 'react-virtualized'
import { Match, Miss, Link } from 'react-router'
import 'react-virtualized/styles.css'
import './App.css'
import Collections from './Collections'

const server_path = ({
  host,
  port,
  username,
  db
}) => `${username}/${host}/${port}/${db}`

const is_empty = (state, key) => {
  const ids = state.remote_ids[key] || []

  return (
    !state.loading[key]
    && (typeof state.remote_ids[key] !== 'undefined')
    && !ids.length
  )
}

const treeIcon = (expanded, leaf, object, empty, loading) => {
  if (loading) return <i className="material-icons md-11">autorenew</i>

  if (object && empty) return '';
  if (leaf) return '';

  return <i
    className="material-icons md-11">
    {expanded ? 'remove' : 'add'}
  </i>
}

const steps = ({is_last}) => is_last.slice(0, -1).map((is_last,i) => <div
    key={i}
    className={['verticalLine', is_last ? 'last' : ''].join(' ')}
  >
  </div>
)

const Expand = ({
  is_last,
  leaf,
  empty,
  expanded,
  loading,
  handleToggleTree,
  object
}) => {
  let classNames = [
    'dirtree',
    is_last[is_last.length - 1] ? 'dirtree_elbow' : 'dirtree_tee'
  ]
  if (loading) classNames.push('loading')
  if (leaf) classNames.push('leaf')
  if (!leaf) classNames.push(expanded ? 'dirtree_minus' : 'dirtree_plus')

  return (
    <a
      href="#"
      className={classNames.join(' ')}
      onClick={handleToggleTree}>
      <span>{treeIcon(expanded, leaf, object, empty, loading)}</span>
    </a>
  )
}

const PGIcon = ({url, icon, handleNodeSelected}) => <Link
  to={url}
  className={`browserIcon ${icon}`}
/>

const Label = ({url, label, handleNodeSelected}) => <a
  href={url}
  className="browserLabel"
  onClick={handleNodeSelected}>
  {label}
</a>

const Tree = (props) => <div
    style={props.style}
    className={['treeNode', props.selected ? 'selected' : ''].join(' ')}
  >
  {steps(props)}
  <Expand {...props} />
  <PGIcon {...props} />
  <Label {...props} />
</div>

const Collection = ({params, ...collection}) => {
  return (
    <div>{collection.name}</div>
  )
}

class App extends Component {
  constructor() {
    super()

    this.state = {
      loading: { servers: true },
      expanded: {},
      remote_ids: {},
      remote_data: {},
      selected: null
    }
  }
  url_for = ([server_id, ...rest]) => {
    const {username,host,port,db} = this.state.remote_data.servers[server_id]

    return '/' + [
      username,
      host,
      port,
      db,
      ...rest
    ].map(u => encodeURIComponent(u)).join('/')
  }
  handleNodeSelected = (path) => {
    this.setState({ selected: path })
  }
  handleToggleObject = (path) => {
    let expanded = {...this.state.expanded}

    expanded[path] = !expanded[path]
    this.setState({ expanded })
  }
  handleToggleCollection = (ancestors, remote_key_field) => {
    const path = ancestors.join('/')
    let expanded = {...this.state.expanded}
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}
    let loading = {...this.state.loading}

    expanded[path] = !expanded[path]

    if (!expanded[path]) {
      this.setState({ expanded })
      return
    }

    if (remote_ids[path]) {
      this.setState({ expanded })
      return
    }

    loading[path] = true
    this.setState({ loading, expanded })

    fetch('/api' + this.url_for(ancestors))
      .then(response => response.json())
      .then(json => {
        let ids = json.map(item => item[remote_key_field])
        let data = {}
        json.forEach(item => { data[item[remote_key_field]] = item })

        remote_ids[path] = ids
        remote_data[path] = data
        loading[path] = false

        this.setState({ expanded, remote_ids, remote_data, loading })
      })
  }
  componentDidMount() {
    fetch('/api/servers')
      .then(response => response.json())
      .then(json => {
        let ids = json.map(server_path)
        let data = {}
        json.forEach(server => { data[server_path(server)] = server })

        this.setState({
          remote_ids: { servers: ids },
          remote_data: { servers: data },
          loading: { servers: false }
        })
      })
  }
  dbObject = ({list, config, ...props}) => {
    const ids = this.state.remote_ids[props.key] || []
    if (ids.length) props.label = `${props.label} (${ids.length})`

    list.push({
      loading: this.state.loading[props.key],
      leaf: is_empty(this.state, props.key),
      ...props
    })

    if (!props.expanded) return

    ids.forEach( (id, i) => {
      const item = this.state.remote_data[props.key][id]
      const ancestors = [...props.ancestors, item[config.item_label_field]]
      const path = ancestors.join('/')

      this.dbCollection({
        list,
        ancestors,
        key: path,
        url: this.url_for(ancestors),
        icon: config.item_icon(item),
        label: item[config.item_label_field],
        expanded: this.state.expanded[path],
        selected: this.state.selected === path,
        handleToggleTree: (e) => {
          e.preventDefault()
          this.handleToggleObject(path)
        },
        is_last: props.is_last.concat([ids.length - 1 === i]),
        collections: Collections[config.name] || [],
        handleNodeSelected: (e) => {
          e.preventDefault()
          this.handleNodeSelected(path)
        }
      })
    })
  }
  dbCollection = ({list, collections, ...props}) => {
    list.push({ leaf: !collections.length, ...props })

    if (!props.expanded) return

    collections.forEach( (collection, i) => {
      const ancestors = [...props.ancestors, collection.name]
      const path = ancestors.join('/')

      this.dbObject({
        list,
        ancestors,
        key: path,
        url: this.url_for(ancestors),
        icon: collection.name,
        label: collection.label,
        expanded: this.state.expanded[path],
        selected: this.state.selected === path,
        handleToggleTree: (e) => {
          e.preventDefault();
          this.handleToggleCollection(ancestors, collection.item_label_field)
        },
        is_last: props.is_last.concat([collections.length - 1 === i]),
        config: collection,
        handleNodeSelected: (e) => {
          e.preventDefault();
          this.handleNodeSelected(path)
        }
      })
    })
  }
  render() {
    if (this.state.loading.servers) return <div>Loading...</div>

    const ids = this.state.remote_ids.servers
    let list = [];

    ids.forEach( (id, i) => {
      const server = this.state.remote_data.servers[id]

      let props = {
        key: this.url_for([id]),
        ancestors: [id],
        url: this.url_for([id]),
        icon: 'server',
        label: `${server.name} (${server.host}:${server.port})`,
        expanded: this.state.expanded[id],
        selected: this.state.selected === id,
        handleToggleTree: () => this.handleToggleObject(id),
        is_last: [ids.length - 1 === i],
        collections: Collections.servers,
        handleNodeSelected: (e) => {
          e.preventDefault()
          this.handleNodeSelected(id)
        }
      }

      this.dbCollection({list, ...props})
    })

    let routes = []
    Collections.servers.forEach( (collection) => {
      routes.push(<Match
        key={collection.name}
        exactly
        pattern={`/:username/:host/:port/:db/${collection.name}`}
        component={({params}) => <Collection params={params} {...collection}/>}
      />)
    })

    return (
      <SplitPane split="vertical" minSize={50} defaultSize={300}>
        <div className="Browser">
          <AutoSizer>
            {({ height, width }) => (
              <List
                rowCount={list.length}
                height={height}
                rowHeight={21}
                rowRenderer={({ index, style }) => <Tree
                  style={style}
                  {...list[index]}
                />}
                width={width} />
            )}
          </AutoSizer>
        </div>
        <div>
          <Match exactly pattern="/" render={() => <div>Servers</div>} />
          <Match exactly pattern="/:username/:host/:port/:db" component={() => <div>Server</div>} />
          {routes.map(route => route)}
          <Miss render={() => <h1>Not Found</h1>} />
        </div>
      </SplitPane>
    )
  }
}

export default App;
