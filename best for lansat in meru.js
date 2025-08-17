
/**********************
 Robust Landsat RGB composites for MERU
 Years: 2005, 2010, 2015, 2020, 2025
 Only Landsat C02 collections. Clips to your 'projects/ee-celestakim019/assets/counties' MERU feature.
**********************/

// 0) MERU boundary
var counties = ee.FeatureCollection('projects/ee-celestakim019/assets/counties');
var meru = counties.filter(ee.Filter.eq('COUNTY_NAM', 'MERU'));
if (meru.size().lt(1)) {
 
}
var meru = meru.first();
var roi = meru.geometry();
Map.centerObject(roi, 9);
Map.addLayer(roi, {color: 'red'}, 'MERU boundary');

// 1) Sensor -> Tier1 + Tier2 collection IDs (C02)
var SENSOR_COLS = {
  L5: ['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LT05/C02/T2_L2'],
  L7: ['LANDSAT/LE07/C02/T1_L2', 'LANDSAT/LE07/C02/T2_L2'],
  L8: ['LANDSAT/LC08/C02/T1_L2', 'LANDSAT/LC08/C02/T2_L2'],
  L9: ['LANDSAT/LC09/C02/T1_L2', 'LANDSAT/LC09/C02/T2_L2']
};

// 2) Cloud/shadow mask using QA_PIXEL bits (Collection-2 L2)
function maskQA_PIXEL(img) {
  // QA_PIXEL bits: we require these bits == 0 to keep pixel
  // bit0 fill, bit1 dilated cloud, bit2 cirrus, bit3 cloud, bit4 cloud shadow, bit5 snow (approx)
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 0).eq(0)
             .and(qa.bitwiseAnd(1 << 1).eq(0))
             .and(qa.bitwiseAnd(1 << 2).eq(0))
             .and(qa.bitwiseAnd(1 << 3).eq(0))
             .and(qa.bitwiseAnd(1 << 4).eq(0))
             .and(qa.bitwiseAnd(1 << 5).eq(0));
  return img.updateMask(mask);
}

// 3) Scale surface reflectance bands (Collection-2 L2)
function scaleSR(img, bandNames) {
  // scale only the requested SR bands
  var scaled = img.select(bandNames).multiply(0.0000275).add(-0.2);
  // Keep other bands (like QA_PIXEL) if needed by copying properties
  return img.addBands(scaled, null, true).copyProperties(img, img.propertyNames());
}

// 4) Build merged collection for a sensor list and date window
function mergedCollectionForSensors(sensorList, startDate, endDate) {
  var col = ee.ImageCollection([]);
  sensorList.forEach(function(s) {
    var ids = SENSOR_COLS[s];
    // merge Tier1 + Tier2 for that sensor
    col = col
      .merge(ee.ImageCollection(ids[0]).filterDate(startDate, endDate).filterBounds(roi))
      .merge(ee.ImageCollection(ids[1]).filterDate(startDate, endDate).filterBounds(roi));
  });
  // keep broad cloud cover threshold here (we mask later); reduce chance of empty set
  return col.filter(ee.Filter.lte('CLOUD_COVER', 90));
}

// 5) Robust per-year composite try sequence
// sensorTries: ordered array of sensor families to try e.g. ['L5','L7']
// rgbBands: SR band names to extract for that family (e.g. ['SR_B3','SR_B2','SR_B1'])
function robustYearComposite(year, sensorTries, rgbBands) {
  // helper: attempt with given expandYears (0,1,2)
  function tryWithExpand(expandYears) {
    var start = ee.Date.fromYMD(year - expandYears, 1, 1);
    var end = ee.Date.fromYMD(year + expandYears, 12, 31);
    // merge across all sensorTries (in case we passed a list)
    var base = mergedCollectionForSensors(sensorTries, start, end)
      .map(function(img) { return scaleSR(img, rgbBands); })
      .map(maskQA_PIXEL);
    return base;
  }
  
  // priority:
  // 1) exact-year masked median
  // 2) exact-year unmasked median
  // 3) ±1 year masked median
  // 4) ±1 year unmasked median
  // 5) ±2 year masked median
  // 6) ±2 year unmasked median
  // 7) placeholder black image
  var base0 = tryWithExpand(0); // exact year
  var base1 = tryWithExpand(1); // ±1 year
  var base2 = tryWithExpand(2); // ±2 years
  
  var base0_unmasked = mergedCollectionForSensors(sensorTries, ee.Date.fromYMD(year,1,1), ee.Date.fromYMD(year,12,31))
                        .map(function(img){ return scaleSR(img, rgbBands); });
  var base1_unmasked = mergedCollectionForSensors(sensorTries, ee.Date.fromYMD(year-1,1,1), ee.Date.fromYMD(year+1,12,31))
                        .map(function(img){ return scaleSR(img, rgbBands); });
  var base2_unmasked = mergedCollectionForSensors(sensorTries, ee.Date.fromYMD(year-2,1,1), ee.Date.fromYMD(year+2,12,31))
                        .map(function(img){ return scaleSR(img, rgbBands); });
  
  var base0_count = base0.size();
  var base1_count = base1.size();
  var base2_count = base2.size();
  var base0u_count = base0_unmasked.size();
  var base1u_count = base1_unmasked.size();
  var base2u_count = base2_unmasked.size();
  
  var placeholder = ee.Image.constant([0,0,0]).rename(rgbBands).clip(roi);
  
  // Pick best available composite using server-side logic
  var chosen = ee.Image(ee.Algorithms.If(
    base0_count.gt(0), base0.median(),
    ee.Algorithms.If(
      base0u_count.gt(0), base0_unmasked.median(),
      ee.Algorithms.If(
        base1_count.gt(0), base1.median(),
        ee.Algorithms.If(
          base1u_count.gt(0), base1_unmasked.median(),
          ee.Algorithms.If(
            base2_count.gt(0), base2.median(),
            ee.Algorithms.If(
              base2u_count.gt(0), base2_unmasked.median(),
              placeholder
            )
          )
        )
      )
    )
  )).clip(roi);
  
  // Ensure the selected image actually contains the SR bands (some collections may have different names)
  var hasBand = ee.List(chosen.bandNames()).contains(rgbBands[0]);
  var selected = ee.Image(ee.Algorithms.If(hasBand, chosen.select(rgbBands), placeholder)).rename(['R','G','B']).clip(roi);
  
  // succeeded flag: true if any collection had images (exact or ±2)
  var succeeded = base0_count.gt(0).or(base0u_count.gt(0))
                   .or(base1_count.gt(0)).or(base1u_count.gt(0))
                   .or(base2_count.gt(0)).or(base2u_count.gt(0));
  
  return selected.set('year', year).set('succeeded', succeeded);
}

// 6) Year-by-year preferences + building composites
function buildForYear(year) {
  if (year === 2005) {
    // prefer L5, fallback to L7
    var compL5 = robustYearComposite(2005, ['L5'], ['SR_B3','SR_B2','SR_B1']);
    var compL7 = robustYearComposite(2005, ['L7'], ['SR_B3','SR_B2','SR_B1']);
    var chosen = ee.Image(ee.Algorithms.If(compL5.get('succeeded'), compL5, compL7));
    return chosen.set('sensorChoice', ee.String(ee.Algorithms.If(compL5.get('succeeded'), 'L5', 'L7')) );
  }
  if (year === 2010) {
    var c5 = robustYearComposite(2010, ['L5'], ['SR_B3','SR_B2','SR_B1']);
    var c7 = robustYearComposite(2010, ['L7'], ['SR_B3','SR_B2','SR_B1']);
    var chosen = ee.Image(ee.Algorithms.If(c5.get('succeeded'), c5, c7));
    return chosen.set('sensorChoice', ee.String(ee.Algorithms.If(c5.get('succeeded'), 'L5', 'L7')) );
  }
  if (year === 2015) {
    var c8 = robustYearComposite(2015, ['L8'], ['SR_B4','SR_B3','SR_B2']);
    var c9 = robustYearComposite(2015, ['L9'], ['SR_B4','SR_B3','SR_B2']);
    var fallback = robustYearComposite(2015, ['L5','L7'], ['SR_B3','SR_B2','SR_B1']);
    var chosen = ee.Image(ee.Algorithms.If(c8.get('succeeded'), c8, ee.Algorithms.If(c9.get('succeeded'), c9, fallback)));
    return chosen.set('sensorChoice', ee.String(ee.Algorithms.If(c8.get('succeeded'), 'L8', ee.Algorithms.If(c9.get('succeeded'), 'L9', 'L5/7'))));
  }
  if (year === 2020) {
    var c8 = robustYearComposite(2020, ['L8'], ['SR_B4','SR_B3','SR_B2']);
    var c9 = robustYearComposite(2020, ['L9'], ['SR_B4','SR_B3','SR_B2']);
    var fallback = robustYearComposite(2020, ['L5','L7'], ['SR_B3','SR_B2','SR_B1']);
    var chosen = ee.Image(ee.Algorithms.If(c8.get('succeeded'), c8, ee.Algorithms.If(c9.get('succeeded'), c9, fallback)));
    return chosen.set('sensorChoice', ee.String(ee.Algorithms.If(c8.get('succeeded'), 'L8', ee.Algorithms.If(c9.get('succeeded'), 'L9', 'L5/7'))));
  }
  if (year === 2025) {
    var c9 = robustYearComposite(2025, ['L9'], ['SR_B4','SR_B3','SR_B2']);
    var c8 = robustYearComposite(2025, ['L8'], ['SR_B4','SR_B3','SR_B2']);
    var fallback = robustYearComposite(2025, ['L5','L7'], ['SR_B3','SR_B2','SR_B1']);
    var chosen = ee.Image(ee.Algorithms.If(c9.get('succeeded'), c9, ee.Algorithms.If(c8.get('succeeded'), c8, fallback)));
    return chosen.set('sensorChoice', ee.String(ee.Algorithms.If(c9.get('succeeded'), 'L9', ee.Algorithms.If(c8.get('succeeded'), 'L8', 'L5/7'))));
  }
  return ee.Image.constant([0,0,0]).rename(['R','G','B']).set('succeeded', false).set('sensorChoice', 'none');
}

// 7) Build & display
var years = [2005, 2010, 2015, 2020, 2025];
var vis = {min: 0, max: 0.3, gamma: 1.1};

years.forEach(function(y) {
  var img = buildForYear(y);
  // Add layer; don't call getInfo() on server-side properties
  Map.addLayer(img, vis, y + ' - Landsat (R,G,B)');
  print(y + ' sensor choice:', img.get('sensorChoice'));
  print(y + ' succeeded?', img.get('succeeded'));
});

// 8) Quick diagnostics: show band names of each produced image
years.forEach(function(y) {
  var img = buildForYear(y);
  print('Bands for ' + y + ':', img.bandNames());
});





















































































































































































// // Load Meru boundary
// var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
// var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU"));

// // Function to scale Landsat L2 SR
// function scaleLandsat(img) {
//   var opticalBands = img.select('SR_B.').multiply(0.0000275).add(-0.2);
//   var thermalBands = img.select('ST_B.*').multiply(0.00341802).add(149.0);
//   return img.addBands(opticalBands, null, true)
//             .addBands(thermalBands, null, true)
//             .copyProperties(img, img.propertyNames());
// }

// // Function to get median composite for a year ±1 year
// function getComposite(year, collectionId, visParams) {
//   var start = ee.Date.fromYMD(year - 1, 1, 1);
//   var end = ee.Date.fromYMD(year + 1, 12, 31);
  
//   var collection = ee.ImageCollection(collectionId)
//     .filterBounds(meru)
//     .filterDate(start, end)
//     .map(scaleLandsat)
//     .map(function(img) {
//       var cloudMask = img.select('QA_PIXEL')
//         .bitwiseAnd(1 << 3).eq(0) // Cloud shadow
//         .and(img.select('QA_PIXEL').bitwiseAnd(1 << 5).eq(0)); // Clouds
//       return img.updateMask(cloudMask);
//     });
  
//   var composite = collection.median().clip(meru);
  
//   Map.addLayer(composite, visParams, 'Landsat ' + year, false);
//   print('Composite for ' + year, composite);
// }

// // Visualization
// var vis = {bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3};

// // Request composites
// getComposite(2005, 'LANDSAT/LT05/C02/T1_L2', vis); // Landsat 5
// getComposite(2010, 'LANDSAT/LE07/C02/T1_L2', vis); // Landsat 7
// getComposite(2015, 'LANDSAT/LC08/C02/T1_L2', vis); // Landsat 8
// getComposite(2020, 'LANDSAT/LC08/C02/T1_L2', vis); // Landsat 8
// getComposite(2025, 'LANDSAT/LC09/C02/T1_L2', vis); // Landsat 9

// Map.centerObject(meru, 9);
