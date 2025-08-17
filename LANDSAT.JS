/**** Robust: Best Landsat every 5 years (2005,2010,2015,2020,2025) over MERU ****/     https://code.earthengine.google.com/6b90ecbee956edf5f91e009c685142d5
/**** Asset: projects/ee-celestakim019/assets/counties with COUNTY_NAM, COUNTY_COD ****/

// 0) Center / geometry
var counties = ee.FeatureCollection('projects/ee-celestakim019/assets/counties');
var meru = counties.filter(ee.Filter.or(
  ee.Filter.eq('COUNTY_NAM', 'MERU'),
  ee.Filter.eq('COUNTY_COD', 12)
)).first();
if (!meru) throw 'MERU county not found. Check COUNTY_NAM/COUNTY_COD.';
var geom = meru.geometry();
Map.centerObject(geom, 9);

// 1) Sensor -> Tier1 & Tier2 collection ids
var sensorCollections = {
  L5: ['LANDSAT/LT05/C02/T1_L2', 'LANDSAT/LT05/C02/T2_L2'],
  L7: ['LANDSAT/LE07/C02/T1_L2', 'LANDSAT/LE07/C02/T2_L2'],
  L8: ['LANDSAT/LC08/C02/T1_L2', 'LANDSAT/LC08/C02/T2_L2'],
  L9: ['LANDSAT/LC09/C02/T1_L2', 'LANDSAT/LC09/C02/T2_L2']
};

// 2) Scale & mask helpers for Collection-2 Level-2 Landsat
function scaleLandsatL2(img) {
  // scale SR_B.* bands to surface reflectance (0-1)
  var scaled = img.select('SR_B.*').multiply(0.0000275).add(-0.2);
  return img.addBands(scaled, null, true);
}
function maskLandsatL2(img) {
  // mask using QA_PIXEL bits: fill, dilated cloud, cirrus, cloud, cloud shadow, snow
  var qa = img.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 0).eq(0)
    .and(qa.bitwiseAnd(1 << 1).eq(0))
    .and(qa.bitwiseAnd(1 << 2).eq(0))
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 4).eq(0))
    .and(qa.bitwiseAnd(1 << 5).eq(0));
  return img.updateMask(mask);
}

// 3) Merge Tier1+Tier2 for given sensor list and year window (expandYears = 0 or 1)
function mergedCollectionsForSensors(sensors, year, expandYears) {
  var start = ee.Date.fromYMD(year - expandYears, 1, 1);
  var end   = ee.Date.fromYMD(year + expandYears, 12, 31);
  var col = ee.ImageCollection([]);
  sensors.forEach(function(s) {
    var ids = sensorCollections[s];
    col = col
      .merge(ee.ImageCollection(ids[0]).filterDate(start, end).filterBounds(geom))
      .merge(ee.ImageCollection(ids[1]).filterDate(start, end).filterBounds(geom));
  });
  // keep a broad cloud cover threshold so we don't return empty sets;
  // you can tighten if you want fewer cloudy images.
  return col.filter(ee.Filter.lte('CLOUD_COVER', 90));
}

// 4) Robust composite builder with prioritized fallbacks
// sensors: array of sensors with compatible SR band names (e.g. ['L8'])
// year: integer
// rgbBands: list of SR band names to select from the median (e.g. ['SR_B4','SR_B3','SR_B2'])
function robustComposite(sensors, year, rgbBands) {
  // exact year
  var base = mergedCollectionsForSensors(sensors, year, 0).map(scaleLandsatL2);
  var masked = base.map(maskLandsatL2);
  var baseCount = base.size();
  var maskedCount = masked.size();

  // +/-1 year expansion
  var baseExp = mergedCollectionsForSensors(sensors, year, 1).map(scaleLandsatL2);
  var maskedExp = baseExp.map(maskLandsatL2);
  var baseExpCount = baseExp.size();
  var maskedExpCount = maskedExp.size();

  // placeholder: black image with expected SR band names (so selection won't fail)
  var placeholder = ee.Image.constant([0,0,0])
    .rename(rgbBands)
    .clip(geom);

  // pick first available composite in priority:
  // 1) masked.median() exact year
  // 2) base.median() exact year
  // 3) maskedExp.median() +/-1 year
  // 4) baseExp.median()
  // 5) placeholder
  var comp = ee.Image(ee.Algorithms.If(
    maskedCount.gt(0), masked.median(),
    ee.Algorithms.If(
      baseCount.gt(0), base.median(),
      ee.Algorithms.If(
        maskedExpCount.gt(0), maskedExp.median(),
        ee.Algorithms.If(baseExpCount.gt(0), baseExp.median(), placeholder)
      )
    )
  )).clip(geom);

  // Ensure the returned image has the expected rgbBands; otherwise use placeholder.
  var selected = ee.Image(ee.Algorithms.If(
    ee.List(comp.bandNames()).contains(rgbBands[0]),
    comp.select(rgbBands).rename(['R','G','B']),
    placeholder.select(rgbBands).rename(['R','G','B'])
  )).clip(geom);

  // success flag if any images existed in exact or expanded window
  var success = baseCount.gt(0).or(baseExpCount.gt(0));

  return selected.set('succeeded', success);
}

// 5) Year preference logic: choose preferred sensor(s) for each target year
function bestForYear(year) {
  if (year === 2005) {
    // prefer L5 (cleaner than L7 SLC-off for many areas), fallback to L7
    var a = robustComposite(['L5'], 2005, ['SR_B3','SR_B2','SR_B1']);
    var b = robustComposite(['L7'], 2005, ['SR_B3','SR_B2','SR_B1']);
    return ee.Image(ee.Algorithms.If(a.get('succeeded'), a, b));
  }
  if (year === 2010) {
    var a = robustComposite(['L5'], 2010, ['SR_B3','SR_B2','SR_B1']);
    var b = robustComposite(['L7'], 2010, ['SR_B3','SR_B2','SR_B1']);
    return ee.Image(ee.Algorithms.If(a.get('succeeded'), a, b));
  }
  if (year === 2015) {
    // prefer L8 family; fallback to L9 (if present) then older L5/L7
    var a = robustComposite(['L8'], 2015, ['SR_B4','SR_B3','SR_B2']);
    var b = robustComposite(['L9'], 2015, ['SR_B4','SR_B3','SR_B2']);
    var c = robustComposite(['L5'], 2015, ['SR_B3','SR_B2','SR_B1']);
    return ee.Image(ee.Algorithms.If(a.get('succeeded'), a, ee.Algorithms.If(b.get('succeeded'), b, c)));
  }
  if (year === 2020) {
    var a = robustComposite(['L8'], 2020, ['SR_B4','SR_B3','SR_B2']);
    var b = robustComposite(['L9'], 2020, ['SR_B4','SR_B3','SR_B2']);
    var c = robustComposite(['L5'], 2020, ['SR_B3','SR_B2','SR_B1']);
    return ee.Image(ee.Algorithms.If(a.get('succeeded'), a, ee.Algorithms.If(b.get('succeeded'), b, c)));
  }
  if (year === 2025) {
    var a = robustComposite(['L9'], 2025, ['SR_B4','SR_B3','SR_B2']);
    var b = robustComposite(['L8'], 2025, ['SR_B4','SR_B3','SR_B2']);
    var c = robustComposite(['L5'], 2025, ['SR_B3','SR_B2','SR_B1']);
    return ee.Image(ee.Algorithms.If(a.get('succeeded'), a, ee.Algorithms.If(b.get('succeeded'), b, c)));
  }
  // default placeholder if year not handled
  return ee.Image.constant([0,0,0]).rename(['R','G','B']).clip(geom).set('succeeded', false);
}

// 6) Build & add layers
var years = [2005, 2010, 2015, 2020, 2025];
var vis = {min: 0.02, max: 0.3, gamma: 1.1};

years.forEach(function(y) {
  var img = bestForYear(y);
  Map.addLayer(img, vis, y + ' - Best Landsat (R,G,B)');
});

// MERU outline for reference
Map.addLayer(ee.Image().paint(geom, 1, 2), {palette:['black']}, 'MERU boundary', true);

// 7) Diagnostics (prints will show server-side booleans)
print('MERU feature:', meru);
years.forEach(function(y) {
  var img = bestForYear(y);
  print(y + ' succeeded?', img.get('succeeded'));
});
