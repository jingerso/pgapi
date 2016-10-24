export default {
  servers: [
    {
      name: 'databases',
      label: 'Databases',
      item_label_field: 'datname',
      item_icon: () => 'database',
      collections: [
        {
          name: 'extensions',
          label: 'Extensions',
          item_label_field: 'extname',
          item_icon: () => 'extension'
        },
        {
          name: 'schemas',
          label: 'Schemas',
          item_label_field: 'nspname',
          item_icon: () => 'schema',
          collections: [
            {
              name: 'tables',
              label: 'Tables',
              item_label_field: 'tablename',
              item_icon: () => 'table',
              collections: [
                {
                  name: 'columns',
                  label: 'Columns',
                  item_label_field: 'attname',
                  item_icon: () => 'column'
                },
                {
                  name: 'indexes',
                  label: 'Indexes',
                  item_label_field: 'relname',
                  item_icon: () => 'index'
                },
                {
                  name: 'constraints',
                  label: 'Constraints',
                  item_label_field: 'conname',
                  item_icon: (item) => 'foreign_key'
                }
              ]
            }
          ]
        }
      ] 
    },
    {
      name: 'tablespaces',
      label: 'Tablespaces',
      item_label_field: 'spcname',
      item_icon: () => 'tablespace'
    },
    {
      name: 'roles',
      label: 'Roles',
      item_label_field: 'rolname',
      item_icon: (item) => item.rolcanlogin ? 'role' : 'group'
    }
  ]
}
