"use strict";

const buildStyle = (fillColor, strokeColor) => new ol.style.Style({
  fill   : new ol.style.Fill({
    color : fillColor
  }),
  stroke : new ol.style.Stroke({
    color : strokeColor
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
  style           : buildStyle([ 255, 255, 204, .35], [ 128, 128, 0, 1 ]),
  toggleCondition : ol.events.condition.always
})
map.getInteractions().push(select)

const dragBox = new ol.interaction.DragBox({
  style     : buildStyle([ 255, 255, 204, .35], [ 128, 128, 0, 1 ]),
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
  select.getFeatures().extend(selected)
  dragBox.setActive(false)
  select.setActive(true)
})

document.querySelector('.dpt').addEventListener('change', e => {
  let selected = vector.getSource().getFeatures().filter(
    f => f.get('insee').substr(0, 2) == e.target.value
  )
  select.getFeatures().clear()
  select.getFeatures().extend(selected)
})

document.querySelector('.all').addEventListener('click', e => {
  select.getFeatures().clear()
  select.getFeatures().extend(vector.getSource().getFeatures())
})

document.querySelector('.none').addEventListener('click', e => {
  select.getFeatures().clear()
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
    } else {
      select.getFeatures().push(f)
    }
    f.setStyle(buildStyle([255, 0, 0, .5], [255, 0, 0, .2]))
    setTimeout(() => f.setStyle(), 350)
  }
})

const debounce = (func, wait, immediate) => {
  let timeout
  return function() {
    var context = this, args = arguments
    var later = () => {
      timeout = null
      if (!immediate) func.apply(context, args)
    }
    var callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}

select.getFeatures().on('change:length', debounce(() => {
  const features = select.getFeatures()
  document.querySelector('.count').innerText = features.getLength()
  let list = document.querySelector('.list')
  while (list.firstChild) { list.removeChild(list.firstChild) }

  features.getArray().sort(
    (a,b) => a.get('nom').localeCompare(b.get('nom'))
  )
  for (let i = 0 ; i < 10 && i < features.getLength() ; i++) {
    let node = document.createElement('li')
    node.innerText = features.item(i).get('nom')
    list.appendChild(node)
  }
}, 100))

