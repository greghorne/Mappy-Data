# mappy
**GIS Mapping & Data**


*Overview:*

- Given a polygon on the map, calculate demographics.

*What does this webpage do:*

- Display a map in the browser.
- The user can use the "marker" tool (upper left corner) to click on the map or type in location information into the search box to specify a location.
- Only locations within the United States are supported.
- A 3 minute isochrone (drive-time) polygon is then calculated using Route360 REST Services and is subsequently displayed onto the map.  
- Demographic informaton that is calculated within the isochrone polygon is also displayed.  2010 Census Block data is used for the calculation and uniform distribution of data is assumed.
- Click the '?' icon on the webpage for more information.

*Tech Stack:*

- Ruby 2.4.0
- Rails 5.0.0
- Google Maps API v3
- REST Service (www.route360.net) to return an Isochrone (drive-time polygon)
- 2010 Census Block Data - Population, Housing Counts & Geographic information
- PostgreSQL with PostGIS extension
- Raspberry Pi 2 - PostgreSQL Server Host (see: <a href="https://github.com/greghorne/loadCensusBlocks" target="_blank">https://github.com/greghorne/loadCensusBlocks</a>)
- Deployment: Heroku free dyno

Deployment: http://www.mappydata.com

