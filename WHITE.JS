// Load Meru county boundary
var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var meru = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU"));

// Center map
Map.centerObject(meru, 8);

// ------------------- HELPERS -------------------

// Landsat composite helper
function landsatComposite(startYear, endYear, collection, bandMap, label) {
  var col = collection
    .filterDate(ee.Date.fromYMD(startYear,1,1), ee.Date.fromYMD(endYear,12,31))
    .filterBounds(meru)
    .map(function(img){
      return img.select(bandMap[0], bandMap[1])
                .rename(['red','green','blue'])
                .clip(meru);
    });
  var comp = col.median();
  Map.addLayer(comp, {bands:['red','green','blue'], min:0, max:3000}, startYear + "-" + endYear + " (" + label + ")");
  return comp;
}

// Sentinel-2 composite helper
function sentinelComposite(startYear, endYear, label) {
  var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterDate(ee.Date.fromYMD(startYear,1,1), ee.Date.fromYMD(endYear,12,31))
    .filterBounds(meru)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
    .map(function(img){
      return img.select(['B4','B3','B2'])
                .rename(['red','green','blue'])
                .clip(meru);
    });
  var comp = col.median();
  Map.addLayer(comp, {bands:['red','green','blue'], min:0, max:0.3}, startYear + "-" + endYear + " (" + label + ")");
  return comp;
}

// ------------------- COLLECTIONS -------------------
var landsat5 = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2");
var landsat7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
var landsat8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
var landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2");

// ------------------- COMPOSITES -------------------

// 2005 → Landsat 7 ETM+ (gap-filled by median composite)
landsatComposite(2005, 2005, landsat7, [['SR_B3','SR_B2','SR_B1'], ['SR_B3','SR_B2','SR_B1']], "Landsat 7 ETM+");

// 2010 → Landsat 5 TM
landsatComposite(2010, 2010, landsat5, [['SR_B3','SR_B2','SR_B1'], ['SR_B3','SR_B2','SR_B1']], "Landsat 5 TM");

// 2015 → Landsat 8 OLI
landsatComposite(2015, 2015, landsat8, [['SR_B4','SR_B3','SR_B2'], ['SR_B4','SR_B3','SR_B2']], "Landsat 8 OLI");

// 2020 → Sentinel-2
sentinelComposite(2020, 2020, "Sentinel-2 MSI");

// 2025 → Sentinel-2 + Landsat 9 merged
var s2_2025 = sentinelComposite(2025, 2025, "Sentinel-2 MSI");
var l9_2025 = landsatComposite(2025, 2025, landsat9, [['SR_B4','SR_B3','SR_B2'], ['SR_B4','SR_B3','SR_B2']], "Landsat 9 OLI");
var merged2025 = ee.ImageCollection([s2_2025, l9_2025]).median();
Map.addLayer(merged2025, {bands:['red','green','blue'], min:0, max:0.3}, "2025 (Sentinel-2 + Landsat 9)");
