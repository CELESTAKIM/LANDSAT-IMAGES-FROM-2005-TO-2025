// =======================
// 1. Study Area (Meru)
// =======================
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU"))
                    .geometry();

// Function: Cloud mask for Landsat
function maskLandsatSR(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0) // Cloud shadow
               .and(qa.bitwiseAnd(1 << 4).eq(0)); // Clouds
  return image.updateMask(mask).divide(10000);
}

// Function: Get NDVI for given year & Landsat collection
function getNDVI(year, collectionId, nir, red) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end   = ee.Date.fromYMD(year, 12, 31);
  
  var col = ee.ImageCollection(collectionId)
              .filterBounds(meru)
              .filterDate(start, end)
              .map(maskLandsatSR);
  
  var img = col.median();
  
  // Skip empty images
  return ee.Algorithms.If(img.bandNames().size().gt(0),
    img.normalizedDifference([nir, red]).rename('NDVI').clip(meru),
    null
  );
}

// Visualization palette
var ndviVis = {
  min: -0.2, max: 0.8,
  palette: ['red', 'yellow', 'green']
};

// Collect NDVI for different years
var ndvi2000 = getNDVI(2000, "LANDSAT/LE07/C02/T1_L2", 'SR_B4', 'SR_B3');
var ndvi2005 = getNDVI(2005, "LANDSAT/LE07/C02/T1_L2", 'SR_B4', 'SR_B3');
var ndvi2010 = getNDVI(2010, "LANDSAT/LE07/C02/T1_L2", 'SR_B4', 'SR_B3');
var ndvi2015 = getNDVI(2015, "LANDSAT/LC08/C02/T1_L2", 'SR_B5', 'SR_B4');
var ndvi2020 = getNDVI(2020, "LANDSAT/LC08/C02/T1_L2", 'SR_B5', 'SR_B4');
var ndvi2025 = getNDVI(2025, "LANDSAT/LC09/C02/T1_L2", 'SR_B5', 'SR_B4');

// Add layers only if available
function addIfAvailable(img, label) {
  img = ee.Image(img);
  Map.addLayer(img, ndviVis, label);
}

// Center map
Map.centerObject(meru, 9);

// Display
addIfAvailable(ndvi2000, 'NDVI 2000');
addIfAvailable(ndvi2005, 'NDVI 2005');
addIfAvailable(ndvi2010, 'NDVI 2010');
addIfAvailable(ndvi2015, 'NDVI 2015');
addIfAvailable(ndvi2020, 'NDVI 2020');
addIfAvailable(ndvi2025, 'NDVI 2025');
