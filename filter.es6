"use strict";

const buildStyle = (fillColor, strokeColor, width) => new ol.style.Style({
  fill   : new ol.style.Fill({
    color : fillColor
  }),
  stroke : new ol.style.Stroke({
    color : strokeColor,
    width : width || 1
  })
})

const vector = new ol.layer.Vector({
  source : new ol.source.Vector(),
  style  : buildStyle([ 255, 255, 255, .1], [ 0, 0, 0, .2 ])
})

const map = new ol.Map({
  target : document.querySelector('.map'),
  layers : [
    new ol.layer.Tile({
      source : new ol.source.OSM()
    }),
    vector
  ],
  view   : new ol.View({
    center : [ 307582.6018195493, 6432940.300480434 ],
    zoom   : 8
  })
})

const format = new ol.format.GeoJSON()

const highlightStyle = buildStyle([255, 0, 0, .5], [255, 0, 0, .2])
const highlight = (feature) => {
  feature.setStyle(highlightStyle)
  setTimeout(() => feature.setStyle(), 250)
}

const updateSelection = (features, cumulative=false) => {
  const collection = select.getFeatures()
  if (!cumulative) {
    collection.clear()
  }
  const uniques = [ ...new Set(collection.getArray().concat(features)) ]
  collection.clear()
  collection.extend(uniques)
  features.map(highlight)

  // update UI
  document.querySelector('.count').innerText = collection.getLength()
  let list = document.querySelector('.list')
  while (list.firstChild) { list.removeChild(list.firstChild) }

  collection.getArray().sort((a,b) => a.get('nom').localeCompare(b.get('nom')))
  for (let i = 0 ; i < 10 && i < collection.getLength() ; i++) {
    let node = document.createElement('li')
    node.innerText = collection.item(i).get('nom')
    list.appendChild(node)
  }
}

fetch('hdf.json').then(
  response => response.json()
).then(json => {
  let conf = {
    dataProjection    : 'EPSG:4326',
    featureProjection : map.getView().getProjection()
  }
  vector.getSource().addFeatures(format.readFeatures(json, conf))
  vector.getSource().getFeatures().forEach(f => f.setId(f.get('insee')))
})

const select = new ol.interaction.Select({
  multi           : true,
  style           : buildStyle([ 255, 255, 204, .35], [ 128, 128, 0, 1 ], 1.5),
  toggleCondition : ol.events.condition.always
})
map.getInteractions().push(select)
select.on('select', (e) => {
  updateSelection([], true)
  e.selected.map(highlight)
})

const dragBox = new ol.interaction.DragBox({
  condition : ol.events.condition.always
})
map.getInteractions().push(dragBox)
dragBox.setActive(false)
dragBox.on('boxend', function() {
  let extent   = dragBox.getGeometry().getExtent()
  let selected = []
  vector.getSource().forEachFeatureIntersectingExtent(
    extent,
    (feature) => { selected.push(feature) }
  )
  updateSelection(selected, true)
  dragBox.setActive(false)
  select.setActive(true)
})

document.querySelector('.dpt').addEventListener('change', e => {
  let selected = vector.getSource().getFeatures().filter(
    f => f.get('insee').substr(0, 2) == e.target.value
  )
  updateSelection(selected)
})

document.querySelector('.all').addEventListener('click', e => {
  updateSelection(vector.getSource().getFeatures())
})

document.querySelector('.none').addEventListener('click', e => {
  updateSelection([])
})

document.querySelector('.bbox').addEventListener('click', e => {
  select.setActive(false)
  dragBox.setActive(true)
})

const buildRE = (search) => {
  search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  return new RegExp("(" + search.split(' ').join('|') + ")", "gi")
}

new autoComplete({
  selector   : document.querySelector('.search'),
  minChars   : 3,
  source     : (term, response) => {
    let matches = []
    let re      = buildRE(term)
    vector.getSource().getFeatures().forEach(f => {
      if (f.get('nom').match(re)) { matches.push(f) }
    })
    response(matches)
  },
  renderItem : (f, search) =>
    '<div class="autocomplete-suggestion"' +
    'data-val="' + f.get('nom') + '"' +
    'data-id="' + f.getId() + '">' +
    '<span>' +
    ( (select.getFeatures().getArray().indexOf(f) >= 0) ? '✓' : '' ) +
    '</span>' +
    f.get('nom').replace(buildRE(search), "<b>$1</b>") +
    '</div>'
  ,
  onSelect : (e, term, item) => {
    let f = vector.getSource().getFeatureById(item.getAttribute('data-id'))
    if (select.getFeatures().getArray().indexOf(f) >= 0) {
      select.getFeatures().remove(f)
      updateSelection([], true)
    } else {
      updateSelection([f], true)
    }
    f.setStyle(buildStyle([255, 0, 0, .5], [255, 0, 0, .2]))
    setTimeout(() => f.setStyle(), 350)
  }
})
