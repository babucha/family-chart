import d3 from "../d3.js"
import f3 from "../index.js"
import addRelative from "./addRelative.js"
import {deletePerson} from "./form.js"
import { handleLinkRel } from "./addRelative.linkRel.js"

export default function(...args) { return new EditTree(...args) }

function EditTree(cont, store) {
  this.cont = cont
  this.store = store

  this.fields = [
    {type: 'text', label: 'first name', id: 'first name'},
    {type: 'text', label: 'last name', id: 'last name'},
    {type: 'text', label: 'birthday', id: 'birthday'},
    {type: 'text', label: 'avatar', id: 'avatar'}
  ]

  this.form_cont = null

  this.is_fixed = true

  this.history = null
  this.no_edit = false

  this.onChange = null

  this.editFirst = false

  this.postSubmit = null

  this.link_existing_rel_config = null

  this.init()

  return this
}

EditTree.prototype.init = function() {
  this.form_cont = d3.select(this.cont).append('div').classed('f3-form-cont', true).node()
  this.addRelativeInstance = this.setupAddRelative()
  this.createHistory()
}

EditTree.prototype.open = function(datum) {
  if (datum.data.data) datum = datum.data
  if (this.addRelativeInstance.is_active && !datum._new_rel_data) {
    this.addRelativeInstance.onCancel()
    datum = this.store.getDatum(datum.id)
  }

  this.cardEditForm(datum)
}

EditTree.prototype.openWithoutRelCancel = function(datum) {
  this.cardEditForm(datum)
}

EditTree.prototype.cardEditForm = function(datum) {
  const props = {}
  const is_new_rel = datum?._new_rel_data
  if (is_new_rel) {
    props.onCancel = () => this.addRelativeInstance.onCancel()
  } else {
    props.addRelative = this.addRelativeInstance
    props.deletePerson = () => {
      const data = this.store.getData()
      deletePerson(datum, data)
      this.store.updateData(data)
      this.openFormWithId(this.store.getLastAvailableMainDatum().id)

      this.store.updateTree({})
    }
  }

  const form_creator = f3.handlers.createForm({
    store: this.store, 
    datum, 
    postSubmit: postSubmit.bind(this),
    fields: this.fields, 
    addRelative: null,
    onCancel: () => {},
    editFirst: this.editFirst,
    link_existing_rel_config: this.link_existing_rel_config,
    ...props
  })

  form_creator.no_edit = this.no_edit
  if (this.no_edit) form_creator.editable = false
  const form_cont = f3.handlers.formInfoSetup(form_creator, this.closeForm.bind(this))

  this.form_cont.innerHTML = ''
  this.form_cont.appendChild(form_cont)

  this.openForm()

  function postSubmit(props) {
    if (this.addRelativeInstance.is_active) {
      this.addRelativeInstance.onChange(datum, props)
      if (this.postSubmit) this.postSubmit(datum, this.store.getData())
      const active_datum = this.addRelativeInstance.datum
      this.store.updateMainId(active_datum.id)
      this.openWithoutRelCancel(active_datum)
    } else if (datum.to_add && props?.link_rel_id) {
      handleLinkRel(datum, props.link_rel_id, this.store.getData())
      this.store.updateMainId(props.link_rel_id)
      this.openFormWithId(props.link_rel_id)
    } else if (!props?.delete) {
      if (this.postSubmit) this.postSubmit(datum, this.store.getData())
      this.openFormWithId(datum.id)
    }

    if (!this.is_fixed) this.closeForm()
    
    this.store.updateTree({})

    this.updateHistory()
  }
}

EditTree.prototype.openForm = function() {
  d3.select(this.form_cont).classed('opened', true)
}

EditTree.prototype.closeForm = function() {
  d3.select(this.form_cont).classed('opened', false).html('')
  this.store.updateTree({})
}

EditTree.prototype.fixed = function() {
  this.is_fixed = true
  d3.select(this.form_cont).style('position', 'relative')

  return this
}

EditTree.prototype.absolute = function() {
  this.is_fixed = false
  d3.select(this.form_cont).style('position', 'absolute')

  return this
}

EditTree.prototype.setCardClickOpen = function(card) {
  card.setOnCardClick((e, d) => {
    if (this.addRelativeInstance.is_active) {
      this.open(d)
      return
    }
    this.open(d)
    this.store.updateMainId(d.data.id)
    this.store.updateTree({})
  })

  return this
}

EditTree.prototype.openFormWithId = function(d_id) {
  if (d_id) {
    const d = this.store.getDatum(d_id)
    this.openWithoutRelCancel(d)
  } else {
    const d = this.store.getMainDatum()
    this.openWithoutRelCancel(d)
  }
}

EditTree.prototype.createHistory = function() {
  this.history = f3.handlers.createHistory(this.store, this.getStoreDataCopy.bind(this), historyUpdateTree.bind(this))
  this.history.controls = f3.handlers.createHistoryControls(this.cont, this.history)
  this.history.changed()
  this.history.controls.updateButtons()

  return this

  function historyUpdateTree() {
    if (this.addRelativeInstance.is_active) this.addRelativeInstance.onCancel()
    this.store.updateTree({initial: false})
    this.history.controls.updateButtons()
    this.openFormWithId(this.store.getMainDatum()?.id)
    if (this.onChange) this.onChange()
  }
}

EditTree.prototype.setNoEdit = function() {
  this.no_edit = true

  return this
}

EditTree.prototype.setEdit = function() {
  this.no_edit = false

  return this
}

EditTree.prototype.setFields = function(fields) {
  const new_fields = []
  if (!Array.isArray(fields)) {
    console.error('fields must be an array')
    return this
  }
  for (const field of fields) {
    if (typeof field === 'string') {
      new_fields.push({type: 'text', label: field, id: field})
    } else if (typeof field === 'object') {
      if (!field.id) {
        console.error('fields must be an array of objects with id property')
      } else {
        new_fields.push(field)
      }
    } else {
      console.error('fields must be an array of strings or objects')
    }
  }
  this.fields = new_fields

  return this
}

EditTree.prototype.setOnChange = function(fn) {
  this.onChange = fn

  return this
}

EditTree.prototype.addRelative = function(datum) {
  if (!datum) datum = this.store.getMainDatum()
  this.addRelativeInstance.activate(datum)

  return this

}

EditTree.prototype.setupAddRelative = function() {
  return addRelative(this.store, cancelCallback.bind(this))

  function cancelCallback(datum) {
    this.store.updateMainId(datum.id)
    this.store.updateTree({})
    this.openFormWithId(datum.id)
  }
}

EditTree.prototype.setEditFirst = function(editFirst) {
  this.editFirst = editFirst

  return this
}

EditTree.prototype.isAddingRelative = function() {
  return this.addRelativeInstance.is_active
}

EditTree.prototype.setAddRelLabels = function(add_rel_labels) {
  this.addRelativeInstance.setAddRelLabels(add_rel_labels)
  return this
}

EditTree.prototype.setLinkExistingRelConfig = function(link_existing_rel_config) {
  this.link_existing_rel_config = link_existing_rel_config
  return this
}

EditTree.prototype.getStoreDataCopy = function() {  // todo: should make more sense
  let data = JSON.parse(JSON.stringify(this.store.getData()))  // important to make a deep copy of the data
  if (this.addRelativeInstance.is_active) data = this.addRelativeInstance.cleanUp(data)    
  data = f3.handlers.cleanupDataJson(data)
  return data
}

EditTree.prototype.getDataJson = function() {
  return JSON.stringify(this.getStoreDataCopy(), null, 2)
}

EditTree.prototype.updateHistory = function() {
  if (this.history) {
    this.history.changed()
    this.history.controls.updateButtons()
  }

  if (this.onChange) this.onChange()
}

EditTree.prototype.setPostSubmit = function(postSubmit) {
  this.postSubmit = postSubmit

  return this
}

EditTree.prototype.destroy = function() {
  this.history.controls.destroy()
  this.history = null
  d3.select(this.cont).select('.f3-form-cont').remove()
  if (this.addRelativeInstance.onCancel) this.addRelativeInstance.onCancel()
  this.store.updateTree({})

  return this
}
