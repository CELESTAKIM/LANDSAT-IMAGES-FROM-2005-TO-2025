var counties = ee.FeatureCollection("projects/ee-celestakim019/assets/counties");
var roi = counties.filter(ee.Filter.eq("COUNTY_NAM", "MERU"));
Map.centerObject(roi, 9);

// Function to get Landsat composites for a given year
function getLandsatComposite(year) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end   = ee.Date.fromYMD(year, 12, 31);
  
  var collection;
  
  if (year <= 2011) {
    // Landsat 5 (before 2012)
    collection = ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
      .filterBounds(roi)
      .filterDate(start, end)
      .map(function(img){
        return img
          .resample('bilinear')
          .select(
            ['SR_B3','SR_B2','SR_B1'], // RGB = 3-2-1
            ['Red','Green','Blue']
          )
          .multiply(0.0000275).add(-0.2) // scale reflectance
          .copyProperties(img, img.propertyNames());
      });
    print("Year " + year + ": Landsat 5");
    
  } else if (year <= 2013) {
    // Landsat 7 (gap-filled)
    collection = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
      .filterBounds(roi)
      .filterDate(start, end)
      .map(function(img){
        return img
          .resample('bilinear')
          .select(
            ['SR_B3','SR_B2','SR_B1'],
            ['Red','Green','Blue']
          )
          .multiply(0.0000275).add(-0.2);
      });
    print("Year " + year + ": Landsat 7");
    
  } else {
    // Landsat 8 & 9 (after 2013)
    collection = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
      .merge(ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"))
      .filterBounds(roi)
      .filterDate(start, end)
      .map(function(img){
        return img
          .resample('bilinear')
          .select(
            ['SR_B4','SR_B3','SR_B2'], // RGB = 4-3-2
            ['Red','Green','Blue']
          )
          .multiply(0.0000275).add(-0.2);
      });
    print("Year " + year + ": Landsat 8/9");
  }
  
  // Median composite
  var composite = collection.median().clip(roi);
  
  return composite;
}

// Years of interest
var years = [2005, 2010, 2015, 2020, 2025];

// Create composites
years.forEach(function(year){
  var img = getLandsatComposite(year);
  Map.addLayer(img, {bands:['Red','Green','Blue'], min:0, max:0.3}, 'Landsat ' + year);
});

// Center map on Meru
Map.centerObject(roi, 8);
