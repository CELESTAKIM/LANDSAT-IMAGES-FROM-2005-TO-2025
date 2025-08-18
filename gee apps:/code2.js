// =======================
// 1. Study Area: Meru
// =======================
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();
Map.centerObject(meru, 9);

// =======================
// 2. Cloud Mask
// =======================
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0) // shadow
               .and(qa.bitwiseAnd(1 << 4).eq(0)); // cloud
  return image.updateMask(mask).divide(10000);
}

// =======================
// 3. Landsat Loader
// =======================
function getLandsat(year) {
  var col = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                .filterBounds(meru)
                .filterDate(year+'-01-01', year+'-12-31')
                .map(maskLandsatSR)
                .median()
                .clip(meru);
  var ndvi = col.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  return col.addBands(ndvi);
}

var image2015 = getLandsat(2015);
var image2020 = getLandsat(2020);

// =======================
// 4. Training Data (already uploaded)
// =======================
var trainingPoints = ee.FeatureCollection("projects/ee-celestakim019/assets/training_points_meru");

// =======================
// 5. Bands
// =======================
var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI'];

// =======================
// 6. Train Classifier
// =======================
var training2015 = image2015.select(bands).sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 30
});
var classifier = ee.Classifier.smileRandomForest(200).train({
  features: training2015,
  classProperty: 'class',
  inputProperties: bands
});
var classified2015 = image2015.select(bands).classify(classifier);
var classified2020 = image2020.select(bands).classify(classifier);

// =======================
// 7. Change Detection
// =======================
var forest2015 = classified2015.eq(0);
var forest2020 = classified2020.eq(0);

var forestGain = forest2020.and(forest2015.not());
var forestLoss = forest2015.and(forest2020.not());
var noChange = forest2015.eq(forest2020);

var gainLossMap = forestLoss.multiply(1)
                    .add(forestGain.multiply(2))
                    .add(noChange.multiply(0));

// =======================
// 8. Visualization
// =======================
var lulcPalette = ['darkgreen','lightgreen','yellow','brown','red','orange'];
var ndviPalette = ['brown','yellow','lightgreen','green','darkgreen'];
var gainLossPalette = ['lightgray','red','green'];

// =======================
// 9. Legends
// =======================
function addLegend(palette, names, title, position){
  var legend = ui.Panel({style: {position: position, padding: '8px 15px'}});
  legend.add(ui.Label(title, {fontWeight: 'bold', fontSize: '14px'}));
  for(var i=0;i<palette.length;i++){
    var colorBox = ui.Label('', {backgroundColor: palette[i], padding:'8px', margin:'2px'});
    var description = ui.Label(names[i], {margin:'2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox,description], ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}

addLegend(lulcPalette, ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'], 'LULC', 'bottom-right');
addLegend(gainLossPalette, ['No Change','Forest Loss','Forest Gain'], 'Forest Change', 'bottom-left');
addLegend(ndviPalette, ['No Veg','Stressed','Moderate','Healthy','Very Healthy'], 'NDVI', 'top-right');

// =======================
// 10. Accuracy Assessment
// =======================
var withRandom = training2015.randomColumn('random');
var split = 0.7;
var trainingSet = withRandom.filter(ee.Filter.lt('random', split));
var testingSet = withRandom.filter(ee.Filter.gte('random', split));
var rf = ee.Classifier.smileRandomForest(200).train({
  features: trainingSet,
  classProperty: 'class',
  inputProperties: bands
});
var test = testingSet.classify(rf);
var confusionMatrix = test.errorMatrix('class', 'classification');
print('Confusion Matrix', confusionMatrix);
print('Overall Accuracy', confusionMatrix.accuracy());
print('Kappa', confusionMatrix.kappa());

// =======================
// 11. Forest Area Chart
// =======================
var forestArea2015 = classified2015.eq(0).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels: 1e13
}).get('classification');
var forestArea2020 = classified2020.eq(0).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels: 1e13
}).get('classification');
var chart = ui.Chart.array.values([forestArea2015, forestArea2020], 0, ['2015','2020'])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Forest Area (pixels)',
              hAxis: {title: 'Year'},
              vAxis: {title: 'Forest Pixels'},
              legend: {position: 'none'}
            });
print(chart);

// =======================
// 12. Layer Selector (Interactive Panel)
// =======================
var layersDict = {
  "NDVI 2015": image2015.select('NDVI').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "LULC 2015": classified2015.visualize({min:0, max:5, palette: lulcPalette}),
  "NDVI 2020": image2020.select('NDVI').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "LULC 2020": classified2020.visualize({min:0, max:5, palette: lulcPalette}),
  "Forest Gain/Loss": gainLossMap.visualize({min:0, max:2, palette: gainLossPalette})
};

var panel = ui.Panel({style: {position: 'top-left'}});
panel.add(ui.Label('Toggle Layers',{fontWeight:'bold'}));

Object.keys(layersDict).forEach(function(name){
  var checkbox = ui.Checkbox({label: name, value: false});
  checkbox.onChange(function(checked){
    if(checked){
      Map.addLayer(layersDict[name], {}, name);
    } else {
      Map.layers().forEach(function(l){if(l.getName()===name) Map.remove(l);});
    }
  });
  panel.add(checkbox);
});

Map.add(panel);
