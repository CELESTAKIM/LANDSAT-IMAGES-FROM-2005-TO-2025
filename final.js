// =======================
// 1. Study Area (Meru)
// =======================
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();

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
// 3. NDVI & RGB Functions
// =======================
function getNDVI(year, collectionId, nir, red, yearsWindow) {
  yearsWindow = yearsWindow || 1;
  var start = ee.Date.fromYMD(year - Math.floor(yearsWindow/2), 1, 1);
  var end = ee.Date.fromYMD(year + Math.floor(yearsWindow/2), 12, 31);
  
  var col = ee.ImageCollection(collectionId)
              .filterBounds(meru)
              .filterDate(start, end)
              .map(maskLandsatSR);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.normalizedDifference([nir, red]).rename('NDVI'),
                          null);
}

function getRGB(year, collectionId, r, g, b, yearsWindow) {
  yearsWindow = yearsWindow || 1;
  var start = ee.Date.fromYMD(year - Math.floor(yearsWindow/2), 1, 1);
  var end = ee.Date.fromYMD(year + Math.floor(yearsWindow/2), 12, 31);
  
  var col = ee.ImageCollection(collectionId)
              .filterBounds(meru)
              .filterDate(start, end)
              .map(maskLandsatSR);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.select([r,g,b]),
                          null);
}

// =======================
// 4. NDVI Visualization parameters (5-class palette)
// =======================
var ndviVis = {
  min: 0,
  max: 0.8,
  palette: ['brown', 'yellow', 'lightgreen', 'green', 'darkgreen'],
  // Class breaks (optional for legend):
  // 0–0.2: No Veg
  // 0.2–0.4: Stressed
  // 0.4–0.6: Moderate
  // 0.6–0.7: Healthy
  // 0.7–0.8: Very Healthy
};

// // RGB visualization
// var rgbVisL5L7 = {bands:['SR_B3','SR_B2','SR_B1'], min:0, max:0.3};
// var rgbVisL8L9 = {bands:['SR_B4','SR_B3','SR_B2'], min:0, max:0.3};

// =======================
// 5. NDVI & RGB Images
// =======================
var ndvi2005 = getNDVI(2005, "LANDSAT/LT05/C02/T1_L2", 'SR_B4','SR_B3', 3);
var rgb2005  = getRGB(2005, "LANDSAT/LT05/C02/T1_L2", 'SR_B3','SR_B2','SR_B1', 3);

var ndvi2010 = getNDVI(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B4','SR_B3', 3);
var rgb2010  = getRGB(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B3','SR_B2','SR_B1', 3);

var ndvi2015 = getNDVI(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B5','SR_B4');
var rgb2015  = getRGB(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

var ndvi2020 = getNDVI(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B5','SR_B4');
var rgb2020  = getRGB(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

var ndvi2025 = getNDVI(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B5','SR_B4');
var rgb2025  = getRGB(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

// =======================
// 6. Add layers safely
// =======================
Map.centerObject(meru, 9);
function addLayerSafe(img, vis, label) {
  var image = ee.Image(img);
  if (image) Map.addLayer(image, vis, label);
}

// addLayerSafe(ndvi2005, ndviVis, 'NDVI 2005');
// addLayerSafe(rgb2005, rgbVisL5L7, 'RGB 2005');

addLayerSafe(ndvi2010, ndviVis, 'NDVI 2010');
addLayerSafe(rgb2010, rgbVisL5L7, 'RGB 2010');

addLayerSafe(ndvi2015, ndviVis, 'NDVI 2015');
addLayerSafe(rgb2015, rgbVisL8L9, 'RGB 2015');

addLayerSafe(ndvi2020, ndviVis, 'NDVI 2020');
addLayerSafe(rgb2020, rgbVisL8L9, 'RGB 2020');

addLayerSafe(ndvi2025, ndviVis, 'NDVI 2025');
addLayerSafe(rgb2025, rgbVisL8L9, 'RGB 2025');

// =======================
// 7. NDVI Legend (5 classes)
// =======================
function addLegend() {
  var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
  
  var legendTitle = ui.Label('NDVI Vegetation Health', {fontWeight: 'bold', fontSize: '14px'});
  legend.add(legendTitle);
  
  var palette = ['brown','yellow','lightgreen','green','darkgreen'];
  var names = ['No Veg','Stressed Veg','Moderately Healthy','Healthy','Very Healthy'];
  
  for (var i=0; i<palette.length; i++){
    var colorBox = ui.Label('', {backgroundColor: palette[i], padding: '8px', margin: '2px'});
    var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
    var row = ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal'));
    legend.add(row);
  }
  
  Map.add(legend);
}

addLegend();
















































































// // =======================
// // 1. Study Area (Meru)
// // =======================
// var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
// var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();

// // =======================
// // 2. Cloud mask function (Landsat 5/7/8/9)
// // =======================
// function maskLandsatSR(image) {
//   var qa = image.select('QA_PIXEL');
//   var mask = qa.bitwiseAnd(1 << 3).eq(0) // cloud shadow
//               .and(qa.bitwiseAnd(1 << 4).eq(0)); // clouds
//   return image.updateMask(mask).divide(10000);
// }

// // =======================
// // 3. NDVI & RGB Functions
// // =======================
// function getNDVI(year, collectionId, nir, red, yearsWindow) {
//   yearsWindow = yearsWindow || 1; // default 1-year
//   var start = ee.Date.fromYMD(year - Math.floor(yearsWindow/2), 1, 1);
//   var end = ee.Date.fromYMD(year + Math.floor(yearsWindow/2), 12, 31);
  
//   var col = ee.ImageCollection(collectionId)
//               .filterBounds(meru)
//               .filterDate(start, end)
//               .map(maskLandsatSR);
  
//   var img = col.median().clip(meru);
//   return ee.Algorithms.If(img.bandNames().size().gt(0),
//                           img.normalizedDifference([nir, red]).rename('NDVI'),
//                           null);
// }

// function getRGB(year, collectionId, r, g, b, yearsWindow) {
//   yearsWindow = yearsWindow || 1;
//   var start = ee.Date.fromYMD(year - Math.floor(yearsWindow/2), 1, 1);
//   var end = ee.Date.fromYMD(year + Math.floor(yearsWindow/2), 12, 31);
  
//   var col = ee.ImageCollection(collectionId)
//               .filterBounds(meru)
//               .filterDate(start, end)
//               .map(maskLandsatSR);
  
//   var img = col.median().clip(meru);
//   return ee.Algorithms.If(img.bandNames().size().gt(0),
//                           img.select([r,g,b]),
//                           null);
// }

// // =======================
// // 4. Visualization parameters
// // =======================
// var ndviVis = {min:0, max:0.8, palette:['brown','yellow','lightgreen','green','darkgreen']};
// // var rgbVisL5L7 = {bands:['SR_B3','SR_B2','SR_B1'], min:0, max:0.3};
// // var rgbVisL8L9 = {bands:['SR_B4','SR_B3','SR_B2'], min:0, max:0.3};

// // =======================
// // 5. NDVI & RGB images
// // =======================
// // var ndvi2005 = getNDVI(2005, "LANDSAT/LT05/C02/T1_L2", 'SR_B4','SR_B3', 3);
// // var rgb2005  = getRGB(2005, "LANDSAT/LT05/C02/T1_L2", 'SR_B3','SR_B2','SR_B1', 3);

// var ndvi2010 = getNDVI(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B4','SR_B3', 3);
// var rgb2010  = getRGB(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B3','SR_B2','SR_B1', 3);

// var ndvi2015 = getNDVI(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B5','SR_B4');
// var rgb2015  = getRGB(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

// var ndvi2020 = getNDVI(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B5','SR_B4');
// var rgb2020  = getRGB(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

// var ndvi2025 = getNDVI(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B5','SR_B4');
// var rgb2025  = getRGB(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

// // =======================
// // 6. Add layers safely
// // =======================
// Map.centerObject(meru, 9);
// function addLayerSafe(img, vis, label) {
//   var image = ee.Image(img);
//   if (image) Map.addLayer(image, vis, label);
// }

// // addLayerSafe(ndvi2005, ndviVis, 'NDVI 2005');
// // addLayerSafe(rgb2005, rgbVisL5L7, 'RGB 2005');

// addLayerSafe(ndvi2010, ndviVis, 'NDVI 2010');
// addLayerSafe(rgb2010, rgbVisL5L7, 'RGB 2010');

// addLayerSafe(ndvi2015, ndviVis, 'NDVI 2015');
// addLayerSafe(rgb2015, rgbVisL8L9, 'RGB 2015');

// addLayerSafe(ndvi2020, ndviVis, 'NDVI 2020');
// addLayerSafe(rgb2020, rgbVisL8L9, 'RGB 2020');

// addLayerSafe(ndvi2025, ndviVis, 'NDVI 2025');
// addLayerSafe(rgb2025, rgbVisL8L9, 'RGB 2025');

// // =======================
// // 7. NDVI Legend
// // =======================
// function addLegend() {
//   var legend = ui.Panel({
//     style: {position: 'bottom-left', padding: '8px 15px'}
//   });
  
//   var legendTitle = ui.Label('NDVI Vegetation Health', {fontWeight: 'bold', fontSize: '14px'});
//   legend.add(legendTitle);
  
//   var palette = ['brown','yellow','lightgreen','green','darkgreen'];
//   var names = ['No Veg','Stressed Veg','Moderately Healthy','Healthy','Very Healthy'];
  
//   for (var i=0; i<palette.length; i++){
//     var colorBox = ui.Label('', {backgroundColor: palette[i], padding: '8px', margin: '2px'});
//     var description = ui.Label(names[i], {margin: '2px 0 2px 6px'});
//     var row = ui.Panel([colorBox, description], ui.Panel.Layout.Flow('horizontal'));
//     legend.add(row);
//   }
  
//   Map.add(legend);
// }

// addLegend();











































































































































































// =======================
// 1. Study Area (Meru)
// =======================
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU")).geometry();

// =======================
// 2. Cloud mask function (Landsat 7/8/9)
// =======================
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0) // cloud shadow
               .and(qa.bitwiseAnd(1 << 4).eq(0)); // clouds
  return image.updateMask(mask).divide(10000);
}

// =======================
// 3. NDVI function for normal years
// =======================
function getNDVI(year, collectionId, nir, red) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection(collectionId)
              .filterBounds(meru)
              .filterDate(start, end)
              .map(maskLandsatSR);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.normalizedDifference([nir, red]).rename('NDVI'),
                          null);
}

// =======================
// 4. RGB function for normal years
// =======================
function getRGB(year, collectionId, r, g, b) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection(collectionId)
              .filterBounds(meru)
              .filterDate(start, end)
              .map(maskLandsatSR);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.select([r,g,b]),
                          null);
}

// =======================
// 5. Special function for 2005 (loose cloud mask, 3-year window)
// =======================
function getNDVI2005() {
  var start = ee.Date.fromYMD(2004, 1, 1);
  var end = ee.Date.fromYMD(2006, 12, 31);
  
  var col = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
              .filterBounds(meru)
              .filterDate(start, end);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.normalizedDifference(['SR_B4','SR_B3']).rename('NDVI'),
                          null);
}

function getRGB2005() {
  var start = ee.Date.fromYMD(2004, 1, 1);
  var end = ee.Date.fromYMD(2006, 12, 31);
  
  var col = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
              .filterBounds(meru)
              .filterDate(start, end);
  
  var img = col.median().clip(meru);
  return ee.Algorithms.If(img.bandNames().size().gt(0),
                          img.select(['SR_B3','SR_B2','SR_B1']),
                          null);
}

// =======================
// 6. Visualization parameters
// =======================
var ndviVis = {min:-0.2, max:0.8, palette:['red','yellow','green']};
// var rgbVisL5L7 = {bands:['SR_B3','SR_B2','SR_B1'], min:0, max:0.3};
// var rgbVisL8L9 = {bands:['SR_B4','SR_B3','SR_B2'], min:0, max:0.3};

// =======================
// 7. NDVI & RGB images for each year
// =======================
var ndvi2005 = getNDVI2005();
var rgb2005  = getRGB2005();

var ndvi2010 = getNDVI(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B4', 'SR_B3');
var rgb2010  = getRGB(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B3','SR_B2','SR_B1');

var ndvi2015 = getNDVI(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B5', 'SR_B4');
var rgb2015  = getRGB(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

var ndvi2020 = getNDVI(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B5', 'SR_B4');
var rgb2020  = getRGB(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

var ndvi2025 = getNDVI(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B5', 'SR_B4');
var rgb2025  = getRGB(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B4','SR_B3','SR_B2');

// =======================
// 8. Add layers safely
// =======================
Map.centerObject(meru, 9);

function addLayerSafe(img, vis, label) {
  var image = ee.Image(img);
  if (image) Map.addLayer(image, vis, label);
}

// addLayerSafe(ndvi2005, ndviVis, 'NDVI 2005');
// addLayerSafe(rgb2005, rgbVisL5L7, 'RGB 2005');

addLayerSafe(ndvi2010, ndviVis, 'NDVI 2010');
addLayerSafe(rgb2010, rgbVisL5L7, 'RGB 2010');

addLayerSafe(ndvi2015, ndviVis, 'NDVI 2015');
addLayerSafe(rgb2015, rgbVisL8L9, 'RGB 2015');

addLayerSafe(ndvi2020, ndviVis, 'NDVI 2020');
addLayerSafe(rgb2020, rgbVisL8L9, 'RGB 2020');

addLayerSafe(ndvi2025, ndviVis, 'NDVI 2025');
addLayerSafe(rgb2025, rgbVisL8L9, 'RGB 2025');
