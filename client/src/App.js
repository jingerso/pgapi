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

const DbCollection = ({params, pathname}) => {
  return (
    <div>{pathname}</div>
  )
}

const DbObject = ({params, pathname}) => {
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
      return Promise.resolve()
    }

    if (remote_ids[path]) {
      this.setState({ expanded })
      return Promise.resolve()
    }

    loading[path] = true
    this.setState({ loading, expanded })

    return fetch('/api' + path)
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
          this.handleToggleCollection(url, collection.item_label_field).then()
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
  fetchRemote(path, remote_key_field, state) {
    if (state.remote_ids[path] && state.remote_data[path]) {
      return Promise.resolve()
    }

    return fetch('/api' + path)
      .then(response => response.json())
      .then(json => {
        let ids = json.map(item => item[remote_key_field])
        let data = {}
        json.forEach(item => { data[item[remote_key_field]] = item })

        state.remote_ids[path] = ids
        state.remote_data[path] = data
      })
  }
  restoreFromSelected(state) {
    const [username, host, port, ...rest] = this.state.selected.split('/').slice(1)
    const server = server_path({host, port, username})

    if (!rest.length) return

    state.expanded[server] = true
    let ancestors = [server]

    let requests = []
    let collections = Collections.servers

    rest.forEach((path, i) => {
      ancestors.push(path)
      let url = ancestors.join('/')

      state.expanded[url] = true

      if (i % 2 === 0) {
        let collection = collections.find(item => item.name === path)
        collections = collection.collections

        requests.push(this.fetchRemote(url, collection.item_label_field, state))
      }
    })

    return Promise.all(requests)
  }
  async restoreFromLocalForage(state) {
    if (!await localForage.length()) return Promise.resolve()

    let expanded    = await localForage.getItem('expanded')
    let remote_ids  = await localForage.getItem('remote_ids')
    let remote_data = await localForage.getItem('remote_data')
    let splitPos    = await localForage.getItem('splitPos')

    if (splitPos) state.splitPos = splitPos
    if (expanded) state.expanded = expanded

    if (remote_ids) {
      Object.keys(remote_ids).forEach(id => {
        if (state.remote_ids.servers[id]) return

        state.remote_ids[id] = remote_ids[id]
        state.remote_data[id] = remote_data[id]
      })
    }

    return Promise.resolve()
  }
  componentDidMount() {
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}

    fetch('/api/servers')
      .then(response => response.json())
      .then(async json => {
        let ids = json.map(server_path)
        let data = {}
        json.forEach(server => { data[server_path(server)] = server })

        remote_ids.servers = ids
        remote_data.servers = data

        let state = {
          remote_ids,
          remote_data,
          expanded: {...this.state.expanded},
          loading: { servers: false }
        }

        await this.restoreFromLocalForage(state)
        await this.restoreFromSelected(state)

        // scroll to the selected node when the component is first instantiated
        this._scrollToSelected = true

        this.setState(state)
      })
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.location.pathname === this.state.selected) return;

    this.setState({ selected: nextProps.location.pathname })
  }
  render() {
    if (this.state.loading.servers) return <div>Loading...</div>

    const server_prefix = '/:username/:host/:port'
    const db_prefix = `${server_prefix}/databases/:database`
    const schema_prefix = `${db_prefix}/schemas/:schema`
    const table_prefix = `${schema_prefix}/tables/:table`

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

    /*
     * only scroll to index on a full page load/refresh not on
     * programatic browser history push/pop
     */
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
                overscanRowCount={100}
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
          <Match exactly pattern={server_prefix} component={({params}) => <div>{params.host}</div>} />
          <Match exactly pattern={`${server_prefix}/tablespaces`} component={DbCollection} />
          <Match exactly pattern={`${server_prefix}/tablespaces/:tablespace`} component={DbObject} />
          <Match exactly pattern={`${server_prefix}/roles`} component={DbCollection} />
          <Match exactly pattern={`${server_prefix}/roles/role`} component={DbObject} />
          <Match exactly pattern={`${server_prefix}/databases`} component={DbCollection} />
          <Match exactly pattern={db_prefix} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/casts`} component={DbCollection} />
          <Match exactly pattern={`${db_prefix}/casts/:cast`} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/event_triggers`} component={DbCollection} />
          <Match exactly pattern={`${db_prefix}/event_triggers/:event_trigger`} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/extensions`} component={DbCollection} />
          <Match exactly pattern={`${db_prefix}/extensions/:extension`} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/foreign_data_wrappers`} component={DbCollection} />
          <Match exactly pattern={`${db_prefix}/foreign_data_wrappers/:foreign_data_wrapper`} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/languages`} component={DbCollection} />
          <Match exactly pattern={`${db_prefix}/languages/:language`} component={DbObject} />
          <Match exactly pattern={`${db_prefix}/schemas`} component={DbCollection} />
          <Match exactly pattern={schema_prefix} component={DbObject} />
          <Match exactly pattern={`${schema_prefix}/collations`} component={DbCollection} />
          <Match exactly pattern={`${schema_prefix}/collations/:collation`} component={DbObject} />
          <Match exactly pattern={`${schema_prefix}/tables`} component={DbCollection} />
          <Match exactly pattern={table_prefix} component={DbObject} />
          <Match exactly pattern={`${table_prefix}/columns`} component={DbCollection} />
          <Match exactly pattern={`${table_prefix}/columns/:column`} component={DbObject} />
          <Match exactly pattern={`${table_prefix}/indexes`} component={DbCollection} />
          <Match exactly pattern={`${table_prefix}/indexes/:index`} component={DbObject} />
          <Match exactly pattern={`${table_prefix}/constraints`} component={DbCollection} />
          <Match exactly pattern={`${table_prefix}/constraints/:constraint`} component={DbObject} />
          <Miss render={() => <h1>Not Found</h1>} />
        </div>
      </SplitPane>
    )
  }
}

export default App;
