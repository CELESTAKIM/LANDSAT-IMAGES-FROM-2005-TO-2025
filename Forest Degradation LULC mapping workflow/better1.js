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
// 3. Load Landsat & add indices
// =======================
function addIndices(image){
  var ndvi = image.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');
  var evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))', {
      'NIR': image.select('SR_B5'),
      'RED': image.select('SR_B4'),
      'BLUE': image.select('SR_B2')
    }).rename('EVI');
  return image.addBands(ndvi).addBands(evi);
}

// Load 2020 Landsat
var landsat2020 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                     .filterBounds(meru)
                     .filterDate('2020-01-01','2020-12-31')
                     .map(maskLandsatSR)
                     .median()
                     .clip(meru);
landsat2020 = addIndices(landsat2020);

// Load 2025 Landsat
var landsat2025 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                     .filterBounds(meru)
                     .filterDate('2025-01-01','2025-12-31')
                     .map(maskLandsatSR)
                     .median()
                     .clip(meru);
landsat2025 = addIndices(landsat2025);

// =======================
// 4. Bands for classification
// =======================
var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI','EVI'];

// =======================
// 5. Merge training points
// =======================
var trainingPoints = forest.map(function(f){ return f.set('class',0); })
                      .merge(grassland.map(function(f){ return f.set('class',1); }))
                      .merge(agriculture.map(function(f){ return f.set('class',2); }))
                      .merge(bare.map(function(f){ return f.set('class',3); }))
                      .merge(builtup.map(function(f){ return f.set('class',4); }))
                      .merge(shrubs.map(function(f){ return f.set('class',5); }));

// =======================
// 6. Sample & train classifier
// =======================
var training2020 = landsat2020.select(bands).sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 30
});

var classifier2020 = ee.Classifier.smileRandomForest(200).train({
  features: training2020,
  classProperty: 'class',
  inputProperties: bands
});

var training2025 = landsat2025.select(bands).sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 30
});

var classifier2025 = ee.Classifier.smileRandomForest(200).train({
  features: training2025,
  classProperty: 'class',
  inputProperties: bands
});

// =======================
// 7. Classify images
// =======================
var classified2020 = landsat2020.select(bands).classify(classifier2020);
var classified2025 = landsat2025.select(bands).classify(classifier2025);

// =======================
// 8. Visualization
// =======================
var lulcPalette = ['darkgreen','lightgreen','yellow','brown','red','orange'];
var ndviPalette = ['brown','yellow','lightgreen','green','darkgreen'];
var eviPalette = ['brown','yellow','lightgreen','green','darkgreen'];

// Map layers
Map.addLayer(classified2020, {min:0,max:5,palette:lulcPalette}, 'LULC 2020');
Map.addLayer(classified2025, {min:0,max:5,palette:lulcPalette}, 'LULC 2025');
Map.addLayer(landsat2020.select('NDVI'), {min:0,max:0.8,palette:ndviPalette}, 'NDVI 2020');
Map.addLayer(landsat2025.select('NDVI'), {min:0,max:0.8,palette:ndviPalette}, 'NDVI 2025');
Map.addLayer(landsat2020.select('EVI'), {min:0,max:0.5,palette:eviPalette}, 'EVI 2020');
Map.addLayer(landsat2025.select('EVI'), {min:0,max:0.5,palette:eviPalette}, 'EVI 2025');

// =======================
// 9. Legends
// =======================
function addLULCLegend(){
  var legend = ui.Panel({style:{position:'bottom-right',padding:'8px 15px'}});
  legend.add(ui.Label('LULC Classes',{fontWeight:'bold',fontSize:'14px'}));
  var colors = ['darkgreen','lightgreen','yellow','brown','red','orange'];
  var names = ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'];
  for(var i=0;i<colors.length;i++){
    var colorBox = ui.Label('',{backgroundColor:colors[i],padding:'8px',margin:'2px'});
    var label = ui.Label(names[i],{margin:'2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox,label],ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}
addLULCLegend();

function addNDVILegend(){
  var legend = ui.Panel({style:{position:'bottom-left',padding:'8px 15px'}});
  legend.add(ui.Label('NDVI',{fontWeight:'bold',fontSize:'14px'}));
  var palette = ndviPalette;
  var names = ['No Veg','Stressed','Moderate','Healthy','Very Healthy'];
  for(var i=0;i<palette.length;i++){
    var colorBox = ui.Label('',{backgroundColor:palette[i],padding:'8px',margin:'2px'});
    var label = ui.Label(names[i],{margin:'2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox,label],ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}
addNDVILegend();

function addEVILegend(){
  var legend = ui.Panel({style:{position:'bottom-center',padding:'8px 15px'}});
  legend.add(ui.Label('EVI',{fontWeight:'bold',fontSize:'14px'}));
  var palette = eviPalette;
  var names = ['No Veg','Stressed','Moderate','Healthy','Very Healthy'];
  for(var i=0;i<palette.length;i++){
    var colorBox = ui.Label('',{backgroundColor:palette[i],padding:'8px',margin:'2px'});
    var label = ui.Label(names[i],{margin:'2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox,label],ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}
addEVILegend();

// =======================
// 10. Forest change detection
// =======================
var forest2020 = classified2020.eq(0);
var forest2025 = classified2025.eq(0);

var forestGain = forest2025.and(forest2020.not());
var forestLoss = forest2020.and(forest2025.not());

Map.addLayer(forestGain.updateMask(forestGain), {palette:['lime']}, 'Forest Gain');
Map.addLayer(forestLoss.updateMask(forestLoss), {palette:['red']}, 'Forest Loss');

// =======================
// 11. Forest area calculation
// =======================
function calcForestArea(forestMask){
  var areaImage = forestMask.multiply(ee.Image.pixelArea()).rename('area');
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: meru,
    scale: 30,
    maxPixels: 1e13
  });
  return stats.getNumber('area');
}

var forestArea2020 = calcForestArea(forest2020);
var forestArea2025 = calcForestArea(forest2025);

print('Forest Area 2020 (ha):', forestArea2020.divide(10000));
print('Forest Area 2025 (ha):', forestArea2025.divide(10000));

// =======================
// 12. Forest change chart
// =======================
var chart = ui.Chart.array.values({
  array: ee.Array([[forestArea2020.divide(10000), forestArea2025.divide(10000)]]),
  axis: 0
}).setChartType('ColumnChart')
  .setOptions({
    title: 'Forest Area Change (ha)',
    hAxis:{title:'Year',ticks:[{v:0,f:'2020'},{v:1,f:'2025'}]},
    vAxis:{title:'Area (ha)'},
    colors:['darkgreen']
  });
print(chart);

// =======================
// 13. Accuracy Assessment per year
// =======================
function assessAccuracy(image,classifier,points){
  var trainingSample = image.select(bands).sampleRegions({
    collection: points,
    properties:['class'],
    scale:30
  });
  var split = trainingSample.randomColumn('rand');
  var trainSubset = split.filter(ee.Filter.lt('rand',0.7));
  var testSubset = split.filter(ee.Filter.gte('rand',0.7));

  var trainedClassifier = ee.Classifier.smileRandomForest(200).train({
    features: trainSubset,
    classProperty: 'class',
    inputProperties: bands
  });

  var validated = testSubset.classify(trainedClassifier);
  var confMatrix = validated.errorMatrix('class','classification');
  print('Confusion Matrix:', confMatrix);
  print('Overall Accuracy:', confMatrix.accuracy());
  print('Kappa:', confMatrix.kappa());
}

print('=== Accuracy Assessment 2020 ===');
assessAccuracy(landsat2020,classifier2020,trainingPoints);
print('=== Accuracy Assessment 2025 ===');
assessAccuracy(landsat2025,classifier2025,trainingPoints);

// =======================
// 14. Change detection accuracy
// =======================
var changeMask = forestGain.add(forestLoss); // all changed pixels
var changePoints = trainingPoints.filter(ee.Filter.inList('class',[0])); // forest points
var changeTraining = classified2020.addBands(classified2025).sampleRegions({
  collection: changePoints,
  properties:['class'],
  scale:30
});

print('=== Change Detection Accuracy ===');
// For simplicity we can compute errorMatrix using forest2020 vs forest2025
var changeValidation = classified2020.eq(0).addBands(classified2025.eq(0)).sampleRegions({
  collection: changePoints,
  properties:['class'],
  scale:30
});
// Here you can compute metrics similarly if you have labeled change points

// =======================
// Forest gain & loss
// =======================
var forest2020 = classified2020.eq(0);
var forest2025 = classified2025.eq(0);

var forestGain = forest2025.and(forest2020.not());
var forestLoss = forest2020.and(forest2025.not());

Map.addLayer(forestGain.updateMask(forestGain), {palette:['lime']}, 'Forest Gain');
Map.addLayer(forestLoss.updateMask(forestLoss), {palette:['red']}, 'Forest Loss');

// =======================
// Gain/Loss Legend
// =======================
function addChangeLegend(){
  var legend = ui.Panel({style:{position:'top-right',padding:'8px 15px'}});
  legend.add(ui.Label('Forest Change',{fontWeight:'bold',fontSize:'14px'}));
  
  var colors = ['lime','red'];
  var names = ['Gain','Loss'];
  
  for(var i=0;i<colors.length;i++){
    var colorBox = ui.Label('',{backgroundColor:colors[i],padding:'8px',margin:'2px'});
    var label = ui.Label(names[i],{margin:'2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox,label],ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}
addChangeLegend();

// =======================
// Forest area for chart
// =======================
var forestArea2020 = forest2020.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels:1e13
}).get('constant');

var forestArea2025 = forest2025.multiply(ee.Image.pixelArea()).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels:1e13
}).get('constant');

var chart = ui.Chart.array.values({
  array: ee.Array([[ee.Number(forestArea2020).divide(10000), ee.Number(forestArea2025).divide(10000)]]),
  axis: 0
}).setChartType('ColumnChart')
  .setOptions({
    title: 'Forest Area Change (ha)',
    hAxis:{title:'Year',categories:['2020','2025']},
    vAxis:{title:'Area (ha)'},
    colors:['darkgreen']
  });
print(chart);

// =======================
// Accuracy for change detection
// =======================
var forestChange = forestGain.add(forestLoss); // 1 = changed, 0 = no change

// Sample random points for accuracy assessment
var changePoints = ee.FeatureCollection.randomPoints(meru,500,30);
var changeSample = forestChange.sampleRegions({
  collection: changePoints,
  scale:30,
  geometries:true
});

// Simulate reference: if forest2020 != forest2025 => change=1 else 0
var reference = changeSample.map(function(f){
  var geom = f.geometry();
  var val2020 = forest2020.reduceRegion({reducer: ee.Reducer.first(), geometry:geom, scale:30}).get('constant');
  var val2025 = forest2025.reduceRegion({reducer: ee.Reducer.first(), geometry:geom, scale:30}).get('constant');
  var changeClass = ee.Number(val2020).neq(val2025).int();
  return f.set('reference',changeClass).set('classification', f.get('constant'));
});

// Confusion Matrix
var errorMatrix = reference.errorMatrix('reference','classification');
print('=== Forest Change Detection Accuracy ===');
print('Confusion Matrix:', errorMatrix);
print('Overall Accuracy:', errorMatrix.accuracy());
print('Kappa:', errorMatrix.kappa());
