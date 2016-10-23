import React, { Component } from 'react'
import fetch from 'isomorphic-fetch'
import SplitPane from 'react-split-pane'
import { AutoSizer, List } from 'react-virtualized'
import { Match, Miss } from 'react-router'
import 'react-virtualized/styles.css'
import './App.css'
import Collections from './Collections'
import Tree from './Browser.jsx'

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

const Collection = ({params, pathname}) => {
  return (
    <div>{pathname}</div>
  )
}

const getLocal = key => {
  const serialized = localStorage.getItem(key)

  if (!serialized) return {}

  return JSON.parse(serialized)
}

const setLocal = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

class App extends Component {
  constructor(props) {
    super(props)

    console.log(localStorage)
    this.state = {
      loading: { servers: true },
      expanded: getLocal('expanded'),
      remote_ids: getLocal('remote_ids'),
      remote_data: getLocal('remote_data'),
      selected: props ? props.location.pathname : null
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
  handleToggleObject = (path) => {
    let expanded = {...this.state.expanded}

    expanded[path] = !expanded[path]
    this.setState({ expanded })
  }
  handleToggleCollection = (path, remote_key_field) => {
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

    fetch('/api' + path)
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
      const url = this.url_for(ancestors)

      this.dbCollection({
        list,
        ancestors,
        url,
        key: url,
        icon: config.item_icon(item),
        label: item[config.item_label_field],
        expanded: this.state.expanded[url],
        selected: this.state.selected === url,
        handleToggleTree: (e) => {
          e.preventDefault()
          this.handleToggleObject(url)
        },
        is_last: props.is_last.concat([ids.length - 1 === i]),
        collections: Collections[config.name] || []
      })
    })
  }
  dbCollection = ({list, collections, ...props}) => {
    list.push({ leaf: !collections.length, ...props })

    if (!props.expanded) return

    collections.forEach( (collection, i) => {
      const ancestors = [...props.ancestors, collection.name]
      const url = this.url_for(ancestors)

      this.dbObject({
        list,
        ancestors,
        url,
        key: url,
        icon: collection.name,
        label: collection.label,
        expanded: this.state.expanded[url],
        selected: this.state.selected === url,
        handleToggleTree: (e) => {
          e.preventDefault();
          this.handleToggleCollection(url, collection.item_label_field)
        },
        is_last: props.is_last.concat([collections.length - 1 === i]),
        config: collection
      })
    })
  }
  setState(args) {
    super.setState(args)

    const {expanded, remote_ids, remote_data} = args

    if (expanded) setLocal('expanded', expanded)
    if (remote_ids) setLocal('remote_ids', remote_ids)
    if (remote_data) setLocal('remote_data', remote_data)
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
  componentWillReceiveProps(nextProps) {
    if (nextProps.location.pathname === this.state.selected) return;

    this.setState({ selected: nextProps.location.pathname })
  }
  render() {
    if (this.state.loading.servers) return <div>Loading...</div>

    const ids = this.state.remote_ids.servers
    let list = [];

    ids.forEach( (id, i) => {
      const server = this.state.remote_data.servers[id]
      const path = this.url_for([id])

      let props = {
        key: path,
        ancestors: [id],
        url: path,
        icon: 'server',
        label: `${server.name} (${server.host}:${server.port})`,
        expanded: this.state.expanded[id],
        selected: this.state.selected === '/' + id,
        handleToggleTree: () => this.handleToggleObject(id),
        is_last: [ids.length - 1 === i],
        collections: Collections.servers
      }

      this.dbCollection({list, ...props})
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
          <Match exactly pattern="/:username/:host/:port/:db" component={({params}) => <div>{params.host}</div>} />
          <Match exactly pattern="/:username/:host/:port/:db/databases" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/:db/databases/:database" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/:db/tablespaces" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/:db/tablespaces/:tablespace" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/:db/roles" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/:db/roles/:role" component={Collection} />
          <Miss render={() => <h1>Not Found</h1>} />
        </div>
      </SplitPane>
    )
  }
}

export default App;
