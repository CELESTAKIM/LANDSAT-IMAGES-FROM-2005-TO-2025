// =======================
// EXPORT TRAINING POINTS TO ASSETS
// =======================

// First, merge all training geometries into one FeatureCollection
var trainingPoints = forest
                      .merge(grassland)
                      .merge(agriculture)
                      .merge(bare)
                      .merge(builtup)
                      .merge(shrubs);

// Export as a table to Assets
Export.table.toAsset({
  collection: trainingPoints,
  description: 'Export_TrainingPoints',
  assetId: 'users/your_username/training_points_meru'
});

// (Optional) also export as CSV to Drive if you want local copy
Export.table.toDrive({
  collection: trainingPoints,
  description: 'TrainingPoints_Meru',
  folder: 'GEE_Exports',
  fileFormat: 'CSV'
});


// =======================
// EXPORT LULC 2020 CLASSIFICATION TO DRIVE
// =======================

Export.image.toDrive({
  image: classified2020,
  description: 'LULC_2020_Meru',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LULC_2020_Meru',
  region: meru,
  scale: 30,
  maxPixels: 1e13
});

// =======================
// (OPTIONAL) EXPORT LULC 2015 FOR COMPARISON
// =======================

Export.image.toDrive({
  image: classified2015,
  description: 'LULC_2015_Meru',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LULC_2015_Meru',
  region: meru,
  scale: 30,
  maxPixels: 1e13
});
