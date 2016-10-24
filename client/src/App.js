import React, { Component } from 'react'
import fetch from 'isomorphic-fetch'
import localForage from 'localforage'
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
  username
}) => `/${username}/${host}/${port}`

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

class App extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: { servers: true },
      expanded: {},
      remote_ids: {},
      remote_data: {},
      selected: props ? props.location.pathname : null,
      splitPos: 300
    }

    //localForage.clear()
  }
  url_for = ([server_id, ...rest]) => {
    const {username,host,port} = this.state.remote_data.servers[server_id]

    return '/' + [
      username,
      host,
      port,
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
        collections: config.collections || []
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

    let ops = []
    const {expanded, remote_ids, remote_data} = args

    if (expanded) ops.push(localForage.setItem('expanded', expanded))
    if (remote_ids) ops.push(localForage.setItem('remote_ids', remote_ids))
    if (remote_data) ops.push(localForage.setItem('remote_data', remote_data))

    if (ops.length) Promise.all(ops)
  }
  expandToSelected() {
    if (!this.state.selected) return

    let requests = []
    const [username, host, port, ...rest] = this.state.selected.split('/').slice(1)

    if (!rest.length) return

    let expanded = {...this.state.expanded}
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}

    let ancestors = [server_path({host, port, username})]

    rest.forEach((path, i) => {
      ancestors.push(path)
      let url = this.url_for(ancestors)

      expanded[url] = true

      console.log('%s => %s', path, url)
    })
  }
  async restoreSession(state) {
    let session = await Promise.all([
      localForage.getItem('expanded'),
      localForage.getItem('remote_ids'),
      localForage.getItem('remote_data'),
      localForage.getItem('splitPos')
    ]).then(results => {
      return {
        expanded: results[0],
        remote_ids: results[1],
        remote_data: results[2],
        splitPos: results[3]
      }
    })

    console.log(session)

    if (session.splitPos) state.splitPos = session.splitPos
    if (session.expanded) state.expanded = session.expanded

    if (session.remote_ids) {
      Object.keys(session.remote_ids).forEach(id => {
        if (state.remote_ids.servers[id]) return

        state.remote_ids[id] = session.remote_ids[id]
        state.remote_data[id] = session.remote_data[id]
      })
    }

    // scroll to the selected node when the component is first instantiated
    this._scrollToSelected = true

    this.setState(state, () => { console.log(this.state)})
    console.log(this.state)
  }
  componentDidMount() {
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}

    fetch('/api/servers')
      .then(response => response.json())
      .then(json => {
        let ids = json.map(server_path)
        let data = {}
        json.forEach(server => { data[server_path(server)] = server })

        remote_ids.servers = ids
        remote_data.servers = data

        this.restoreSession({
          remote_ids,
          remote_data,
          expanded: {...this.state.expanded},
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
    let scrollToIndex

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

    if (this._scrollToSelected) {
      scrollToIndex = list.findIndex(item => item.selected)
      this._scrollToSelected = false
    }

    return (
      <SplitPane
        split="vertical"
        minSize={50}
        defaultSize={this.state.splitPos || 300}
        onChange={size => localForage.setItem('splitPos', size)}
      >
        <div className="Browser">
          <AutoSizer>
            {({ height, width }) => (
              <List
                rowCount={list.length}
                height={height}
                rowHeight={21}
                scrollToIndex={scrollToIndex}
                scrollToAlignment="center"
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
          <Match exactly pattern="/:username/:host/:port" component={({params}) => <div>{params.host}</div>} />
          <Match exactly pattern="/:username/:host/:port/databases" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/databases/:database" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/tablespaces" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/tablespaces/:tablespace" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/roles" component={Collection} />
          <Match exactly pattern="/:username/:host/:port/roles/:role" component={Collection} />
          <Miss render={() => <h1>Not Found</h1>} />
        </div>
      </SplitPane>
    )
  }
}

export default App;
