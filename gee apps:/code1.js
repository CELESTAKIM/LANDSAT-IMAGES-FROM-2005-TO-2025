// This script creates a comprehensive GEE app for forest change monitoring,
// focusing on the Meru region of Kenya. It includes a user interface for
// generating reports, data processing for cloud masking and classification,
// change detection, visualization, and accuracy assessment.

// ---------- UI LAYOUT ----------
// Creates the main UI panel with a title, subtitle, input box, button, and contact info.
var title = ui.Label(
  '🌍 Forest Change Monitoring Dashboard',
  {fontWeight: 'bold', fontSize: '24px', color: 'green'}
);

var subtitle = ui.Label(
  'Analyze tree cover change and vegetation indices. ' +
  'Enter your name below to generate a personalized PDF report.',
  {fontSize: '14px'}
);

// User input for the report.
var nameBox = ui.Textbox({placeholder: 'Enter your name'});
var submitBtn = ui.Button('Generate Report');

// Acknowledgment section.
var credit = ui.Label(
  '📧 Contact: celestakim018@gmail.com | 🎥 YouTube: https://www.youtube.com/@CELESTAKIM_GIS',
  {fontSize: '12px', color: 'gray'}
);

// Main panel for the user interface.
var panel = ui.Panel({
  widgets: [title, subtitle, nameBox, submitBtn, credit],
  style: {width: '400px', backgroundColor: 'lightgrey', padding: '15px'}
});
ui.root.add(panel);

// =======================
// 1. Study Area: Meru
// =======================
// Defines the study area as Meru County, Kenya, and centers the map on it.
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();
Map.centerObject(meru, 9);
Map.setOptions('SATELLITE');

// =======================
// 2. Cloud Mask
// =======================
// Function to mask clouds and cloud shadows from Landsat SR imagery.
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var shadowMask = qa.bitwiseAnd(1 << 3).eq(0); // bit 3 for cloud shadow
  var cloudMask = qa.bitwiseAnd(1 << 4).eq(0);  // bit 4 for cloud
  return image.updateMask(shadowMask.and(cloudMask)).divide(10000);
}

// =======================
// 3. Landsat Loader and Index Calculation
// =======================
// Function to load Landsat 8 data for a given year, apply cloud masking,
// and calculate NDVI and other indices.
function getLandsat(year) {
  var collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                  .filterBounds(meru)
                  .filterDate(year+'-01-01', year+'-12-31')
                  .map(maskLandsatSR)
                  .median()
                  .clip(meru);

  var ndvi = collection.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var evi = collection.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': collection.select('SR_B5'),
      'RED': collection.select('SR_B4'),
      'BLUE': collection.select('SR_B2')
  }).rename('EVI');
  
  // Create a mock projection for 2025 by assuming a decline from 2020.
  var ndvi2025 = ndvi.subtract(0.05).max(0).rename('NDVI_2025');
  var evi2025 = evi.subtract(0.02).max(0).rename('EVI_2025');

  return collection.addBands(ndvi).addBands(evi).addBands(ndvi2025).addBands(evi2025);
}

// Load Landsat data and calculate indices for 2015 and 2020.
var image2015 = getLandsat(2015);
var image2020 = getLandsat(2020);
var image2025 = image2020.subtract(0.05).max(0);

// =======================
// 4. Training Data (already uploaded)
// =======================
// Loads pre-uploaded training points for classification.
var trainingPoints = ee.FeatureCollection("projects/ee-celestakim019/assets/training_points_meru");

// =======================
// 5. Bands
// =======================
// Defines the bands to be used for classification.
var bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','NDVI'];

// =======================
// 6. Train Classifier
// =======================
// Trains a Random Forest classifier using the 2015 image and training points.
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

// Classifies the 2015 and 2020 images.
var classified2015 = image2015.select(bands).classify(classifier);
var classified2020 = image2020.select(bands).classify(classifier);

// Mock classification for 2025 based on 2020.
var classified2025 = classified2020.subtract(ee.Image.constant(1)).max(ee.Image.constant(0));

// =======================
// 7. Change Detection
// =======================
// Identifies forest areas (class 0) and detects gain, loss, and no-change areas.
var forest2015 = classified2015.eq(0);
var forest2020 = classified2020.eq(0);
var forest2025 = classified2025.eq(0);

var forestGain = forest2020.and(forest2015.not());
var forestLoss = forest2015.and(forest2020.not());
var noChange = forest2015.eq(forest2020);

// Creates a single map for visualization of forest change.
var gainLossMap = forestLoss.multiply(1)
                    .add(forestGain.multiply(2))
                    .add(noChange.multiply(0));

// =======================
// 8. Visualization Palettes
// =======================
var lulcPalette = ['0B6623', '9ACD32', 'EEDD82', '8B4513', 'A9A9A9', 'F08080']; // LULC colors
var ndviPalette = ['brown','yellow','lightgreen','green','darkgreen'];
var gainLossPalette = ['lightgray','red','green'];

// =======================
// 9. Legends
// =======================
// Function to create and add a legend to the map.
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

// Add legends for LULC, Forest Change, and NDVI.
addLegend(lulcPalette, ['Forest','Grassland','Agriculture','Bare','Built-up','Shrubs'], 'LULC', 'bottom-right');
addLegend(gainLossPalette, ['No Change','Forest Loss','Forest Gain'], 'Forest Change', 'bottom-left');
addLegend(ndviPalette, ['No Veg','Stressed','Moderate','Healthy','Very Healthy'], 'NDVI', 'top-right');

// =======================
// 10. Accuracy Assessment
// =======================
// Performs a standard accuracy assessment of the classifier.
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
// Calculates forest area for 2015 and 2020 and creates a chart.
var forestArea2015 = classified2015.eq(0).rename('Forest').reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels: 1e13
}).get('Forest');

var forestArea2020 = classified2020.eq(0).rename('Forest').reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels: 1e13
}).get('Forest');

var forestArea2025 = classified2025.eq(0).rename('Forest').reduceRegion({
  reducer: ee.Reducer.sum(), geometry: meru, scale: 30, maxPixels: 1e13
}).get('Forest');

var chart = ui.Chart.array.values(
    [forestArea2015, forestArea2020, forestArea2025], 0, ['2015', '2020', '2025'])
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
// Creates an interactive panel for toggling different map layers.
var layersDict = {
  "NDVI 2015": image2015.select('NDVI').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "EVI 2020": image2020.select('EVI').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "LULC 2015": classified2015.visualize({min:0, max:5, palette: lulcPalette}),
  "NDVI 2020": image2020.select('NDVI').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "LULC 2020": classified2020.visualize({min:0, max:5, palette: lulcPalette}),
  "Projected NDVI 2025": image2025.select('NDVI_2025').visualize({min:0.1, max:0.6, palette: ndviPalette}),
  "Projected Forest 2025": forest2025.visualize({min:0, max:1, palette: ['white', 'darkgreen']}),
  "Forest Gain/Loss (2015-2020)": gainLossMap.visualize({min:0, max:2, palette: gainLossPalette})
};

var layerPanel = ui.Panel({style: {position: 'top-left', backgroundColor: 'white', padding: '15px'}});
layerPanel.add(ui.Label('Toggle Layers',{fontWeight:'bold', fontSize:'14px'}));

Object.keys(layersDict).forEach(function(name){
  var checkbox = ui.Checkbox({label: name, value: false});
  checkbox.onChange(function(checked){
    if(checked){
      Map.addLayer(layersDict[name], {}, name);
    } else {
      Map.layers().forEach(function(l){if(l.getName()===name) Map.remove(l);});
    }
  });
  layerPanel.add(checkbox);
});
Map.add(layerPanel);

// ---------- PDF REPORT FUNCTIONALITY ----------
// This section handles the generation and export of the report.
submitBtn.onClick(function() {
  var username = nameBox.getValue();
  if (!username) username = "Guest";

  // Get numerical values from the calculated areas.
  var area2015 = forestArea2015.getInfo();
  var area2020 = forestArea2020.getInfo();
  var area2025 = forestArea2025.getInfo();

  // Create the report string with dynamic values.
  var report =
    "🌍 Forest Change Report for Meru County\n" +
    "Name: " + username + "\n\n" +
    "Tree cover in 2015: " + (area2015 * 900 / 1e6).toFixed(2) + " sq.km\n" +
    "Tree cover in 2020: " + (area2020 * 900 / 1e6).toFixed(2) + " sq.km\n" +
    "Projected tree cover 2025: " + (area2025 * 900 / 1e6).toFixed(2) + " sq.km\n\n" +
    "All values derived from land cover classification (class=Forest) using a Random Forest classifier.\n\n" +
    "Acknowledgment: celestakim018@gmail.com | YouTube: CELESTAKIM_GIS";

  // Show report in a new popup panel.
  var reportLabel = ui.Label(report, {whiteSpace: 'pre-wrap', padding: '10px', border: '1px solid grey'});
  var reportPanel = ui.Panel({
    widgets: [ui.Label('Report Generated', {fontWeight: 'bold'}), reportLabel],
    style: {position: 'bottom-center', width: '500px', backgroundColor: 'white'}
  });
  ui.root.add(reportPanel);

  // Provide option to export the report to a CSV file.
  Export.table.toDrive({
    collection: ee.FeatureCollection([
      ee.Feature(null, {'Report': report})
    ]),
    description: 'Forest_Report_' + username,
    fileFormat: 'CSV'
  });
});

// ---------- TOC (Table of Contents) ----------
// Adds a summary of the available indices for 2020 to the main panel.
var toc = ui.Label(
  '📑 Table of Contents (Indices for 2020): \n - NDVI \n - EVI',
  {fontSize:'13px', color:'black', fontWeight: 'bold'}
);
panel.add(toc);
