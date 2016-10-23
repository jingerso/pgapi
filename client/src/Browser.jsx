import React from 'react'
import classNames from 'classnames'
import { Link } from 'react-router'

const treeIcon = (expanded, object, empty, loading) => {
  if (loading) return <i className="material-icons md-11">autorenew</i>

  if (object && empty) return '';

  return <i
    className="material-icons md-11">
    {expanded ? 'remove' : 'add'}
  </i>
}

const steps = ({is_last}) => is_last.slice(0, -1).map((is_last,i) => <div
    key={i}
    className={classNames('verticalLine', { last: is_last })} />
)

const Branch = ({
  is_last,
  empty,
  expanded,
  loading,
  handleToggleTree,
  object
}) => {
  let expandClass = classNames(
    'dirtree',
    is_last[is_last.length - 1] ? 'dirtree_elbow' : 'dirtree_tee',
    {
      loading,
      dirtree_minus: expanded,
      dirtree_plus: !expanded,
    }
  )
  return (
    <a
      href="#"
      className={expandClass}
      onClick={handleToggleTree}>
      <span>{treeIcon(expanded, object, empty, loading)}</span>
    </a>
  )
}

const Leaf = ({ is_last }) => <a
  className={classNames(
    'dirtree',
    'leaf',
    is_last[is_last.length - 1] ? 'dirtree_elbow' : 'dirtree_tee'
  )}>
  <span />
</a>

const PGIcon = ({url, icon }) => <Link
  to={url}
  className={classNames('browserIcon', icon)}
/>

const Label = ({url, label }) => <Link to={url} className="browserLabel">
  {label}
</Link>

export default (props) => <div
    style={props.style}
    className={classNames('treeNode', {selected: props.selected})}
  >
  {steps(props)}
  {props.leaf ? <Leaf {...props} /> : <Branch {...props} />}
  <PGIcon {...props} />
  <Label {...props} />
</div>
