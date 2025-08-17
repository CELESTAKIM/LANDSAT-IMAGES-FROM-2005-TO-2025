//colab link for contigency table : https://colab.research.google.com/drive/1Cj3WAjxzOG6pnQCVrVWotJHK9po46uIT?usp=sharing
//https://code.earthengine.google.com/e4c99c0696063c785cb061c3de69d4c5
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
// 3. Load 2020 Landsat 8 & compute NDVI
// =======================
var landsat2020 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                     .filterBounds(meru)
                     .filterDate('2020-01-01', '2020-12-31')
                     .map(maskLandsatSR)
                     .median()
                     .clip(meru);

var ndvi2020 = landsat2020.normalizedDifference(['SR_B5','SR_B4']).rename('NDVI');

// =======================
// 4. Stack bands for classification
// =======================
var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI'];
var imageForClassification = landsat2020.addBands(ndvi2020);

// =======================
// 5. Assign class to point FeatureCollections
// // =======================
// var forestPts = forest.map(function(f){ return f.set('class',0); });
// var grasslandPts = grassland.map(function(f){ return f.set('class',1); });
// var agriculturePts = agriculture.map(function(f){ return f.set('class',2); });
// var barePts = bare.map(function(f){ return f.set('class',3); });
// var builtupPts = builtup.map(function(f){ return f.set('class',4); });
// var shrubsPts = shrubs.map(function(f){ return f.set('class',5); });

var trainingPoints = forest
                      .merge(grassland)
                      .merge(agriculture)
                      .merge(bare)
                      .merge(builtup)
                      .merge(shrubs);

// =======================
// 6. Sample image at points
// =======================
var training = imageForClassification.select(bands).sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 30
});

// =======================
// 7. Train classifier
// =======================
var classifier = ee.Classifier.smileRandomForest(200).train({
  features: training,
  classProperty: 'class',
  inputProperties: bands
});

// =======================
// 8. Classify image
// =======================
var classified = imageForClassification.select(bands).classify(classifier);

// =======================
// 9. Visualization
// =======================
var lulcPalette = ['darkgreen','lightgreen','yellow','brown','red','orange'];
Map.addLayer(classified, {min:0, max:5, palette: lulcPalette}, 'LULC 2020');
Map.addLayer(ndvi2020, {min:0, max:0.8, palette:['brown','yellow','lightgreen','green','darkgreen']}, 'NDVI 2020');

// =======================
// 10. Add LULC Legend
// =======================
function addLULCLegend() {
  var legend = ui.Panel({style: {position: 'bottom-right', padding: '8px 15px'}});
  legend.add(ui.Label('LULC 2020', {fontWeight: 'bold', fontSize: '14px'}));

  var colors = ['darkgreen','lightgreen','yellow','brown','red','orange'];
  var names = ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'];

  for (var i=0; i<colors.length; i++){
    var colorBox = ui.Label('', {backgroundColor: colors[i], padding: '8px', margin: '2px'});
    var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
    legend.add(ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}
addLULCLegend();

// =======================
// 11. Accuracy Assessment & Kappa
// =======================
var withRandom = training.randomColumn('random');
var split = 0.7; // 70% training, 30% validation
var trainingSubset = withRandom.filter(ee.Filter.lt('random', split));
var validationSubset = withRandom.filter(ee.Filter.gte('random', split));

var classifierTrain = ee.Classifier.smileRandomForest(200).train({
  features: trainingSubset,
  classProperty: 'class',
  inputProperties: bands
});

var validated = validationSubset.classify(classifierTrain);

var errorMatrix = validated.errorMatrix('class', 'classification');
print('Error Matrix:', errorMatrix);
print('Overall Accuracy:', errorMatrix.accuracy());
print('Kappa:', errorMatrix.kappa());
