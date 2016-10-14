import React, { Component } from 'react'
import fetch from 'isomorphic-fetch'
import './App.css'
import Collections from './Collections'

const server_path = ({host,port,username,db}) => `${username}/${host}/${port}/${db}`

const is_empty = (state, key) => {
  const ids = state.remote_ids[key] || []

  return !state.loading[key] && (typeof state.remote_ids[key] !== 'undefined') && !ids.length
}

const steps = ({is_last}) => is_last.slice(0, -1).map((is_last,i) => <div key={i} className={ is_last ? 'verticalLine last' : "verticalLine" }></div>)

const Expand = ({is_last, leaf, empty, expanded, loading, handleToggleTree, object}) => {
  let classNames = [
    'dirtree',
    is_last[is_last.length - 1] ? 'dirtree_elbow' : 'dirtree_tee'
  ]
  if (loading) classNames.push('loading')
  if (leaf) classNames.push('leaf')

  if (!leaf) classNames.push(expanded ? 'dirtree_minus' : 'dirtree_plus')

  let icon = <i className="material-icons md-11">{expanded ? 'remove' : 'add'}</i>
  if (leaf) icon = ''
  if (object && empty) icon = ''
  if (loading) icon = <i className="material-icons md-11">autorenew</i>

  return (<a href="#" className={classNames.join(' ')} onClick={handleToggleTree}><span>{icon}</span></a>)
}

const Icon = ({url, icon, handleNodeSelected}) => <a href={url} className={`browserIcon ${icon}`} onClick={handleNodeSelected}></a>

const Label = ({url, label, handleNodeSelected}) => <a href={url} className="browserLabel" onClick={handleNodeSelected}>{label}</a>

const Tree = (props) => {
  return (
    <div>
      <div className={`treeNode${props.selected ? ' selected' : ''}`}>
        {steps(props)}
        <Expand {...props} />
        <Icon {...props} />
        <Label {...props} />
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
      remote_data: {},
      selected: null
    }
  }
  url_for = ([server_id, ...rest]) => {
    const {username,host,port,db} = this.state.remote_data.servers[server_id]
    let url = [
      username,
      host,
      port,
      db,
      ...rest
    ]

    return '/' + url.map(u => encodeURIComponent(u)).join('/')
  }
  handleNodeSelected = (canonical) => {
    this.setState({ selected: canonical })
  }
  handleToggleObject = (canonical) => {
    let expanded = {...this.state.expanded}

    expanded[canonical] = !expanded[canonical]
    this.setState({ expanded })
  }
  handleToggleCollection = (ancestors, remote_key_field) => {
    const canonical = ancestors.join('/')
    let expanded = {...this.state.expanded}
    let remote_ids = {...this.state.remote_ids}
    let remote_data = {...this.state.remote_data}
    let loading = {...this.state.loading}

    expanded[canonical] = !expanded[canonical]

    if (!expanded[canonical]) {
      this.setState({ expanded })
      return
    }

    if (remote_ids[canonical]) {
      this.setState({ expanded })
      return
    }

    loading[canonical] = true
    this.setState({ loading, expanded })

    fetch('/api' + this.url_for(ancestors))
      .then(response => response.json())
      .then(json => {
        let ids = json.map(item => item[remote_key_field])
        let data = {}
        json.forEach(item => { data[item[remote_key_field]] = item })

        remote_ids[canonical] = ids
        remote_data[canonical] = data
        loading[canonical] = false

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
  renderObject = ({config, ...props}) => {
    const ids = this.state.remote_ids[props.key] || []
    if (ids.length) props.label = `${props.label} (${ids.length})`

    return (
      <Tree {...props} loading={this.state.loading[props.key]} leaf={is_empty(this.state, props.key)}>
        {ids.map( (id, i) => {
          const item = this.state.remote_data[props.key][id]
          const ancestors = props.ancestors.concat([item[config.item_label_field]])
          const canonical = ancestors.join('/')

          return this.renderCollection({
            ancestors,
            key: canonical,
            url: this.url_for(ancestors),
            icon: config.item_icon(item),
            label: item[config.item_label_field],
            expanded: this.state.expanded[canonical],
            selected: this.state.selected === canonical,
            handleToggleTree: (e) => { e.preventDefault(); this.handleToggleObject(canonical) },
            is_last: props.is_last.concat([ids.length - 1 === i]),
            collections: Collections[config.name] || [],
            handleNodeSelected: (e) => { e.preventDefault(); this.handleNodeSelected(canonical)}
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
            url: this.url_for(ancestors),
            icon: collection.name,
            label: collection.label,
            expanded: this.state.expanded[canonical],
            selected: this.state.selected === canonical,
            handleToggleTree: (e) => { e.preventDefault(); this.handleToggleCollection(ancestors, collection.item_label_field) },
            is_last: props.is_last.concat([collections.length - 1 === i]),
            config: collection,
            handleNodeSelected: (e) => { e.preventDefault(); this.handleNodeSelected(canonical)}
          })
        })}
      </Tree>
    )
  }
  render() {
    if (this.state.loading.servers) return <div>Loading...</div>

    const ids = this.state.remote_ids.servers

    return (
      <div className="Browser">
        {ids.map( (id,i) => {
          const server = this.state.remote_data.servers[id]

          return this.renderCollection({
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
            handleNodeSelected: (e) => { e.preventDefault(); this.handleNodeSelected(id)}
          })
        })}
      </div>
    )
  }
}

export default App;
