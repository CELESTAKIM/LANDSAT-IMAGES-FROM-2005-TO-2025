// =======================
// 1. Study Area: Meru
// =======================
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();
Map.centerObject(meru, 9);

// =======================
// 2. Cloud mask function
// =======================
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0) // cloud shadow
               .and(qa.bitwiseAnd(1 << 4).eq(0)); // clouds
  return image.updateMask(mask).divide(10000);
}

// =======================
// 3. Load Landsat & compute NDVI
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
// 4. Stack bands for classification
// =======================
var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI'];

// =======================
// 5. Merge training points
// =======================
var trainingPoints = forest
                      .merge(grassland)
                      .merge(agriculture)
                      .merge(bare)
                      .merge(builtup)
                      .merge(shrubs);

// =======================
// 6. Sample image at points
// =======================
var training2015 = image2015.select(bands).sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 30
});

// =======================
// 7. Train classifier
// =======================
var classifier = ee.Classifier.smileRandomForest(200).train({
  features: training2015,
  classProperty: 'class',
  inputProperties: bands
});

// =======================
// 8. Classify 2015 and 2020 images
// =======================
var classified2015 = image2015.select(bands).classify(classifier);
var classified2020 = image2020.select(bands).classify(classifier);

// =======================
// 9. Forest change analysis
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
// 10. Visualization
// =======================
var lulcPalette = ['darkgreen','lightgreen','yellow','brown','red','orange'];
var ndviPalette = ['brown','yellow','lightgreen','green','darkgreen'];
var gainLossPalette = ['lightgray','red','green'];

Map.addLayer(image2015.select('NDVI'), {min:0, max:0.8, palette: ndviPalette}, 'NDVI 2015');
Map.addLayer(classified2015, {min:0, max:5, palette: lulcPalette}, 'LULC 2015');

Map.addLayer(image2020.select('NDVI'), {min:0, max:0.8, palette: ndviPalette}, 'NDVI 2020');
Map.addLayer(classified2020, {min:0, max:5, palette: lulcPalette}, 'LULC 2020');

Map.addLayer(gainLossMap, {min:0, max:2, palette: gainLossPalette}, 'Forest Gain/Loss 2015-2020');

// =======================
// 11. Add legends
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

// LULC legend
addLegend(lulcPalette, ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'], 'LULC', 'bottom-right');
// Forest change legend
addLegend(gainLossPalette, ['No Change','Forest Loss','Forest Gain'], 'Forest Change', 'bottom-left');
// NDVI legend
addLegend(ndviPalette, ['No Veg','Stressed','Moderate','Healthy','Very Healthy'], 'NDVI', 'top-right');

// =======================
// 12. Forest area chart
// =======================
var forestArea2015 = classified2015.eq(0).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: meru,
  scale: 30,
  maxPixels: 1e13
}).get('classification');

var forestArea2020 = classified2020.eq(0).reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: meru,
  scale: 30,
  maxPixels: 1e13
}).get('classification');

var chart = ui.Chart.array.values([forestArea2015, forestArea2020], 0, ['2015','2020'])
            .setChartType('ColumnChart')
            .setOptions({
              title: 'Forest Area Change (pixels) in Meru',
              hAxis: {title: 'Year'},
              vAxis: {title: 'Forest Pixels'},
              legend: {position: 'none'}
            });
print(chart);








































































































// // =======================
// // 1. Study Area: Meru
// // =======================
// var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
// var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();
// Map.centerObject(meru, 9);

// // =======================
// // 2. Cloud mask function
// // =======================
// function maskLandsatSR(image) {
//   var qa = image.select('QA_PIXEL');
//   var mask = qa.bitwiseAnd(1 << 3).eq(0) // cloud shadow
//               .and(qa.bitwiseAnd(1 << 4).eq(0)); // clouds
//   return image.updateMask(mask).divide(10000);
// }

// // =======================
// // 3. Load 2020 Landsat 8
// // =======================
// var landsat2020 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
//                     .filterBounds(meru)
//                     .filterDate('2020-01-01', '2020-12-31')
//                     .map(maskLandsatSR)
//                     .median()
//                     .clip(meru);

// // =======================
// // 4. Compute indices
// // =======================
// var ndvi = landsat2020.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
// ndvi = ndvi.updateMask(ndvi.gt(0.05));

// var evi = landsat2020.expression(
//   '2.5 * ((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))', {
//     'NIR': landsat2020.select('SR_B5'),
//     'RED': landsat2020.select('SR_B4'),
//     'BLUE': landsat2020.select('SR_B2')
// }).rename('EVI');

// // =======================
// // 5. Stack bands for classification
// // =======================
// var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI','EVI'];
// var imageForClassification = landsat2020.addBands(ndvi).addBands(evi);

// // =======================
// // 6. Prepare training points
// // =======================
// var trainingPoints = forest
//                       .merge(grassland)
//                       .merge(agriculture)
//                       .merge(bare)
//                       .merge(builtup)
//                       .merge(shrubs);

// // Make sure each point has 'class'
// trainingPoints = trainingPoints.map(function(f){
//   return f.set('class', f.get('class'));
// });

// // =======================
// // 7. Sample image at points
// // =======================
// var training = imageForClassification.select(bands).sampleRegions({
//   collection: trainingPoints,
//   properties: ['class'],
//   scale: 30
// });

// // =======================
// // 8. Train Random Forest classifier
// // =======================
// var classifier = ee.Classifier.smileRandomForest(200).train({
//   features: training,
//   classProperty: 'class',
//   inputProperties: bands
// });

// // =======================
// // 9. Classify image
// // =======================
// var classified = imageForClassification.select(bands).classify(classifier);

// // =======================
// // 10. Visualization palettes
// // =======================
// var lulcPalette = ['darkgreen','lightgreen','yellow','brown','red','orange'];
// var ndviPalette = ['brown','yellow','lightgreen','green','darkgreen'];

// // =======================
// // 11. Display LULC and NDVI
// // =======================
// Map.addLayer(classified, {min:0, max:5, palette: lulcPalette}, 'LULC 2020');
// Map.addLayer(ndvi, {min:0, max:0.8, palette: ndviPalette}, 'NDVI 2020');
// Map.addLayer(evi, {min:0, max:0.8, palette:['brown','yellow','lightgreen','green','darkgreen']}, 'EVI 2020');

// // =======================
// // 12. LULC Legend
// // =======================
// function addLULCLegend() {
//   var legend = ui.Panel({style: {position: 'bottom-right', padding: '8px 15px'}});
//   legend.add(ui.Label('LULC 2020', {fontWeight: 'bold', fontSize: '14px'}));
//   var colors = ['darkgreen','lightgreen','yellow','brown','red','orange'];
//   var names = ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'];
//   for (var i=0; i<colors.length; i++){
//     var colorBox = ui.Label('', {backgroundColor: colors[i], padding: '8px', margin: '2px'});
//     var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
//     legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
//   }
//   Map.add(legend);
// }
// addLULCLegend();

// // =======================
// // 13. NDVI Legend
// // =======================
// function addNDVILegend() {
//   var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
//   legend.add(ui.Label('NDVI Vegetation Health', {fontWeight: 'bold', fontSize: '14px'}));
//   var names = ['No Veg','Stressed Veg','Moderately Healthy','Healthy','Very Healthy'];
//   var palette = ['brown','yellow','lightgreen','green','darkgreen'];
//   for (var i=0; i<palette.length; i++){
//     var colorBox = ui.Label('', {backgroundColor: palette[i], padding: '8px', margin: '2px'});
//     var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
//     legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
//   }
//   Map.add(legend);
// }
// addNDVILegend();
// // =======================
// // EVI Legend
// // =======================
// function addEVILegend() {
//   var legend = ui.Panel({style: {position: 'top-left', padding: '8px 15px'}});
//   legend.add(ui.Label('EVI Vegetation Health', {fontWeight: 'bold', fontSize: '14px'}));
  
//   var names = ['No Veg','Stressed Veg','Moderately Healthy','Healthy','Very Healthy'];
//   var palette = ['brown','yellow','lightgreen','green','darkgreen'];
  
//   for (var i = 0; i < palette.length; i++) {
//     var colorBox = ui.Label('', {backgroundColor: palette[i], padding: '8px', margin: '2px'});
//     var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
//     legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
//   }
  
//   Map.add(legend);
// }

// addEVILegend();


// // =======================
// // 14. Accuracy assessment
// // =======================
// var withRandom = training.randomColumn('random');
// var split = 0.7;  // 70% train, 30% test
// var trainingSet = withRandom.filter(ee.Filter.lt('random', split));
// var testingSet = withRandom.filter(ee.Filter.gte('random', split));

// var rf = ee.Classifier.smileRandomForest(200)
//           .train({
//             features: trainingSet,
//             classProperty: 'class',
//             inputProperties: bands
//           });

// var test = testingSet.classify(rf);

// var confusionMatrix = test.errorMatrix('class', 'classification');
// print('Confusion Matrix:', confusionMatrix);
// print('Overall Accuracy:', confusionMatrix.accuracy());
// print('Kappa Coefficient:', confusionMatrix.kappa());
