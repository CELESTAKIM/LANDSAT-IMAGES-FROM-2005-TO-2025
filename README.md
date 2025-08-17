<img width="1918" height="1031" alt="image" src="https://github.com/user-attachments/assets/23c876d9-864a-4219-a1d5-bff0a6a1c163" />

**NDVI Vegetation Health Visualization – Meru County, Kenya**
Project Overview

This project visualizes vegetation health in Meru County, Kenya, using Landsat satellite imagery for multiple years (2005, 2010, 2015, 2020, 2025). The main product is NDVI (Normalized Difference Vegetation Index) maps, classified into five health categories:

**NDVI Class	Color	Description**
0–0.2	Brown	No vegetation
0.2–0.4	Yellow	Stressed vegetation
0.4–0.6	Light Green	Moderately healthy vegetation
0.6–0.7	Green	Healthy vegetation
0.7–0.8	Dark Green	Very healthy vegetation

RGB composites for reference are also provided for each year.

Features

Study Area:

Meru County, Kenya

Defined using a custom feature collection asset.

Cloud Masking:

Uses Landsat QA_PIXEL band to remove clouds and cloud shadows.

Scales surface reflectance bands to 0–1.

NDVI Calculation:

NDVI = (NIR – Red) / (NIR + Red)

Supports different Landsat sensors (5, 7, 8, 9).

Handles special 3-year window for 2005 to reduce cloud effects.

RGB Composites:

Landsat bands selected for true-color visualization.

Provides a visual reference for landscape and land cover.

Visualization:

NDVI visualized with a 5-color palette representing vegetation health.

RGB composites maintain natural colors.

Map legend shows class names and corresponding colors.

How to Use

Open Google Earth Engine Code Editor: https://code.earthengine.google.com

Create a new script and copy-paste the code.

Run the script.

The map will center on Meru County.

NDVI layers for different years are displayed with the legend.

RGB layers are available for comparison.

Layer Interaction:

Toggle NDVI and RGB layers to compare vegetation health across years.

Use the map legend to interpret NDVI color classes.

Data Sources

Landsat Surface Reflectance Collections (GEE assets):

LANDSAT/LT05/C02/T1_L2 (Landsat 5)

LANDSAT/LE07/C02/T1_L2 (Landsat 7)

LANDSAT/LC08/C02/T1_L2 (Landsat 8)

LANDSAT/LC09/C02/T1_L2 (Landsat 9)

Meru County Boundary: Custom GEE asset: "projects/ee-celestakim019/assets/counties"

Visualization Parameters

NDVI:

min: 0

max: 0.8

Palette: ['brown', 'yellow', 'lightgreen', 'green', 'darkgreen']

RGB:

Landsat 5/7: bands: ['SR_B3','SR_B2','SR_B1'], min: 0, max: 0.3

Landsat 8/9: bands: ['SR_B4','SR_B3','SR_B2'], min: 0, max: 0.3

Notes

NDVI ranges can be adjusted if needed for different vegetation types or local calibration.

The 2005 NDVI uses a 3-year median to reduce cloud contamination.

Legend and visualization are designed to highlight very healthy vegetation in dark green.

Author

KIMATHI JORAM  – GIS & Remote Sensing student, DEKUT **CELESTAKIM018@GMAIL.COM**

Project Date: 2025/8/17
