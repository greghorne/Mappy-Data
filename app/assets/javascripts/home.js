		function openNav() {
		    document.getElementById("myNav").style.height = "100%";
		    document.getElementById("myNav").style.width = "100%";
		}

		function closeNav() {
		    document.getElementById("myNav").style.height = "0%";
		    document.getElementById("myNav").style.width = "0%";
		}

		// default location and zooms
		// var _myLatitude = 36.068250;
		// var _myLongitude = -95.843579;
		var _myLatitude = 39.5;
		var _myLongitude = -98.35;
		var _myZoom = 5;
		var _myZoomGeoLocation = 17;
		var _myDrawingManager;

		var _myInfoWindow;

		var db_server_port = 2346

		// spinner options
		var opts = {
			lines: 13 // The number of lines to draw
			, length: 28 // The length of each line
			, width: 14 // The line thickness
			, radius: 42 // The radius of the inner circle
			, scale: .5 // Scales overall size of the spinner
			, corners: 1 // Corner roundness (0..1)
			, color: '#000' // #rgb or #rrggbb or array of colors
			, opacity: 0.25 // Opacity of the lines
			, rotate: 0 // The rotation offset
			, direction: 1 // 1: clockwise, -1: counterclockwise
			, speed: 1 // Rounds per second
			, trail: 60 // Afterglow percentage
			, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
			, zIndex: 2e9 // The z-index (defaults to 2000000000)
			, className: 'spinner' // The CSS class to assign to the spinner
			, top: '50%' // Top position relative to parent
			, left: '50%' // Left position relative to parent
			, shadow: false // Whether to render a shadow
			, hwaccel: false // Whether to use hardware acceleration
			, position: 'absolute' // Element positioning
		}

		$(document).ready(function() {
			if (document.getElementById('map')) {


				var target = document.getElementById('map')


			   	//////////////////////////////////////	
				// Initializes search box
				////////////////////////////////////////
				function initSearchBoxControl() {

					var input = document.getElementById('pac-input');
					var searchBox = new google.maps.places.SearchBox(input);
					map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);

					map.addListener('bounds_changed', function() {
						searchBox.setBounds(map.getBounds());
					});

					searchBox.addListener('places_changed', function() {
						var places = searchBox.getPlaces();
						if (places.length == 0) { return; }
						clearMap();

						// For each place, get the icon, name and location.
						var bounds = new google.maps.LatLngBounds();
						places.forEach(function(place) {
							var icon = {
								url: place.icon,
								size: new google.maps.Size(71, 71),
								origin: new google.maps.Point(0, 0),
								anchor: new google.maps.Point(17, 34),
								scaledSize: new google.maps.Size(25, 25)
							};

							// Create a marker for each place.
							markers.push(new google.maps.Marker({
								map: map,
								icon: icon,
								title: place.name,
								position: place.geometry.location
							}));

						});

						doIsochrone(places[0].geometry.location.lat(), places[0].geometry.location.lng(), db_server_port)
					})
				};
				//////////////////////////////////////	


		  		// Create a map object and specify the DOM element for display.
		  		var map = new google.maps.Map(document.getElementById('map'), {
		    		center: {lat: _myLatitude, lng: _myLongitude},
		    		scrollwheel: true,
		    		zoom: _myZoom,
		    		// scaleControl: true,
		    		streetViewControl: false,
		    		zoomControl: true,
		    		mapTypeId: 'terrain',
		    		disableDefaultUI: true,
		    		mapTypeControlOptions: {
	              		style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
	              		position: google.maps.ControlPosition.LEFT_BOTTOM
	          		}
	  			});


			  	(function() {

			  		// drawing manager set up (drawing tools)
			  		_myDrawingManager = new google.maps.drawing.DrawingManager({
			  			drawingMode: google.maps.drawing.OverlayType.DEFAULT,
			  			drawingControl: true,
			  			drawingControlOptions: {
			  			 	position: google.maps.ControlPosition.TOP_LEFT,
			  				drawingModes: ['marker']
			  				//drawingModes: ['polygon', 'circle', 'rectangle', 'marker']
			  			}
			  		});

			  		_myDrawingManager.setMap(map);
				})();

				initSearchBoxControl();

	  			var markers = [];

	  			// Set up of custom button controls
				var customControlsDiv = document.createElement('div');
				var customControls = new initCustomControls(customControlsDiv, map);
				customControlsDiv.index = 1;
				customControlsDiv.style['padding-top'] = '10px';
				map.controls[google.maps.ControlPosition.TOP_RIGHT].push(customControlsDiv);

				var attributionControlDiv = document.createElement('div');
				var attributionControl = new initAttributionControl(attributionControlDiv);
				attributionControlDiv.index = 1;
				attributionControlDiv.style['padding-bottom'] = '10px';
				map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(attributionControlDiv, map)

		  		google.maps.event.addListener(_myDrawingManager, 'markercomplete', function(event) {
		  				// remove marker the event automatically sets

		  				event.setMap(null);
		  				doIsochrone(event.getPosition().lat(), event.getPosition().lng(), db_server_port)
		  		});
			};



		   	//////////////////////////////////////	
			// Initializes search box
			////////////////////////////////////////
			function initSearchBoxControl() {

				var input = document.getElementById('pac-input');
				var searchBox = new google.maps.places.SearchBox(input);
				map.controls[google.maps.ControlPosition.TOP_CENTER].push(input);

				map.addListener('bounds_changed', function() {
					searchBox.setBounds(map.getBounds());
				});

				searchBox.addListener('places_changed', function() {
					var places = searchBox.getPlaces();
					if (places.length == 0) { return; }
					clearMap();

					// For each place, get the icon, name and location.
					var bounds = new google.maps.LatLngBounds();
					places.forEach(function(place) {
						var icon = {
							url: place.icon,
							size: new google.maps.Size(71, 71),
							origin: new google.maps.Point(0, 0),
							anchor: new google.maps.Point(17, 34),
							scaledSize: new google.maps.Size(25, 25)
						};

						// Create a marker for each place.
						markers.push(new google.maps.Marker({
							map: map,
							icon: icon,
							title: place.name,
							position: place.geometry.location
						}));

					});

					doIsochrone(places[0].geometry.location.lat(), places[0].geometry.location.lng(), db_server_port)
				})
			};
			//////////////////////////////////////	


			// //////////////////////////////////////	
			// // Generates isochrone
			// //////////////////////////////////////	
		    function doIsochrone(lat, lng, db_server_port) {

				var spinner = new Spinner(opts).spin(target);

				$.ajax({
					url:  "/check_region.json",
					type: "POST",
					data: {lat: lat, lng: lng, db_server_port: db_server_port}
				}).done(function (result) {

					if (result.result === true) {

						clearMap();

						// create a new marker
						var latlng = { lat: lat, lng: lng };
						var marker = new google.maps.Marker({
							position: latlng,
							map: map
						})

						map.setCenter({lat: lat, lng: lng})
					
						// add marker to markers[] and set/create it on the map
						markers.push(marker);
						markers[0].setMap(map);

						$.ajax({
							url:  "/create_isochrone.json",
							type: "POST",
							data: {latitude: lat,
								   longitude: lng,
								   time: 180,
								   db_server_port: db_server_port}
						}).done(function (result) {

							// clear map of previous map features
							map.data.forEach(function(feature) {
								map.data.remove(feature);
							})

							// ====================================================================================
							// if an isochrone is created, then the area will always be greater than zero
							// once it is buffered
							// ====================================================================================
							if (result.area >= 0) {
							// ====================================================================================
							// ====================================================================================

								// ============================================================
								// this is the r360 generated isochrone
								var numberIndicies = result.coordinates[0][0].length
								var coords = []

								for (n = 0; n < numberIndicies; n++) {
									lat = result.coordinates[0][0][n][1]
									lng = result.coordinates[0][0][n][0]
									coords.push({lat: lat, lng: lng})
								}

								// define new polygon and add to map
								var polygon_r360 = new google.maps.Data.Polygon([coords]);

								map.data.add({
									geometry: polygon_r360
								});
								// ============================================================

								// ============================================================
								// this will only capture the outer ring of the buffer polygon
								// meaning at the moment multi-polygons and donuts are skipped
								var buffer = [];
								var length = result.buffer.length;
								var flag = false;
								for (n = 0; n < length; n++) {
									split = result.buffer[n].split(" ")

									if (split[0][0] !== "(" && !flag) {
										lng = split[0];
										lat = split[1];
										buffer.push({lat: parseFloat(lat), lng: parseFloat(lng)})
									} else {
										flag = true
									}
								}

								// define new polygon and add to map
								var polygon_buffer = new google.maps.Data.Polygon([buffer]);
								map.data.setStyle({
									strokeColor: '#c43844',
									strokeOpacity: 0.8,
									strokeWeight: 2,
									fillColor: '#f4d442',
									fillOpacity: .3
								});

								map.data.add({
									geometry: polygon_buffer
								});
								// ============================================================

								// fit map to isochrone polygon
								var bounds = new google.maps.LatLngBounds();
								polygon_buffer.forEachLatLng(function (point) { 
									bounds.extend(new google.maps.LatLng(point.lat(), point.lng()));
								});

								NElat = bounds.getNorthEast().lat();
								NElng = bounds.getNorthEast().lng();
								SWlat = bounds.getSouthWest().lat();
								SWlng = bounds.getSouthWest().lng();
								if (isNaN(NElat) || isNaN(NElng) || isNaN(SWlat) || isNaN(SWlng)) {
									alertify.error("Error: unable to calculate buffer/geometry/demographics")
									map.setZoom(14)
								} else {
						            map.fitBounds(bounds); 
						            alertify.success("Estimated Demographics</br>(2010 Census Block)</br></br>" + "population: " + Math.round(result.pop).toLocaleString() + "</br>housing: " + Math.round(result.housing).toLocaleString())
					        	}

					            spinner.stop()
				            }
				            else alertify.warning("Unable to calculate demographics");
				            spinner.stop()
						});
					} else {
						alertify.error("Calculations only available within USA.  Please try again.")
						spinner.stop()
					}

				});

			
			};
			// //////////////////////////////////////	


		   	//////////////////////////////////////	
			// Initializes search box
			////////////////////////////////////////
			function initAttributionControl(control) {
				var attribution = document.createElement('img');
				attribution.id = 'attribution';
				attribution.title = 'Route360°';
				attribution.src = "/assets/route360_logo.svg";
				attribution.width = "56";
				attribution.height = "56";
				attribution.style.cursor = "pointer"
				control.appendChild(attribution);

				attribution.addEventListener('click', function() {
					window.open("https://www.route360.net")
				});
			}
			//////////////////////////////////////	


			//////////////////////////////
			// Custom button controls set up
			//////////////////////////////
			function initCustomControls(controlDiv, map) {

				// We set up a variable for this since we're adding event listeners later.
				// var controlDiv = this;

				// Set CSS for the control border
				var geolocateUI = document.createElement('img');
				geolocateUI.id = 'geolocateUI';
				geolocateUI.title = 'Geolocate your position';
				geolocateUI.src = "/assets/map.png"
				controlDiv.appendChild(geolocateUI);

				// Set CSS for the control interior
				// var geolocateText = document.createElement('div');
				// geolocateText.id = 'geolocateText';
				// geolocateText.innerHTML = 'Geolocate';
				// geolocateUI.appendChild(geolocateText);

				// Click event for Geolocate
				geolocateUI.addEventListener('click', function() {
					var options = { timeout: 5000, enableHighAccuracy: true }
					navigator.geolocation.getCurrentPosition(success, error, options)
				});
				//////////////////////////////


				//////////////////////////////
				// Clear Map
				//////////////////////////////
				var clearMapUI = document.createElement('img');
				clearMapUI.id = 'clearMapUI';
				clearMapUI.title = 'Clear map';
				clearMapUI.src = "/assets/edit_clear.png"
				controlDiv.appendChild(clearMapUI);

				clearMapUI.addEventListener('click', function() {
					clearMap();
				});
				//////////////////////////////

				//////////////////////////////
				// Change DB Server
				//////////////////////////////
				// var changeDBServerUI = document.createElement('img');
				// changeDBServerUI.id = 'changeDBServerUI';
				// changeDBServerUI.title = 'Change DB Server';
				// changeDBServerUI.src = "/assets/database_refresh.png";
				// controlDiv.appendChild(changeDBServerUI);

				// changeDBServerUI.addEventListener('click', function() {
				//     if (db_server_port === 2345) { 
				//     	db_server_port = 2346;
				//     	alertify.alert("<center>MappyData</center>", "<center>PostgreSQL/PostGIS Database Server is now set to:</br></br><a href='https://www.raspberrypi.org/products/raspberry-pi-2-model-b/' target='_blank'>Raspberry Pi 2 - Raspbian</a> (slowest option)</br></br>(your phone is probably faster than this device)</center>");
				//     } else {
				//     	db_server_port = 2345;
				//     	alertify.alert("<center>MappyData</center>", "<center>PostgreSQL/PostGIS Database Server is now set to:</br></br><a href='https://www.zotac.com/us/product/mini_pcs/bi320-windows-81-bing-0' target='_blank'>Zotac BI320 - Ubuntu</a> (fastest option)<center>");
				//     }
				// });

				//////////////////////////////

				//////////////////////////////
				// FYI
				//////////////////////////////
				var fyiUI = document.createElement('img');
				fyiUI.id = 'fyiUI';
				fyiUI.title = 'Information about this website';
				fyiUI.src = "/assets/help.png"
				controlDiv.appendChild(fyiUI);

				fyiUI.addEventListener('click', function() {
					openNav();
				});
				//////////////////////////////

			};
			//////////////////////////////


			////////////////////////////////////////	
			// Geolocation 'success' function
			////////////////////////////////////////
			function success(location) {
				doIsochrone(location.coords.latitude, location.coords.longitude, db_server_port);
			};
			////////////////////////////////////////
		  	

			////////////////////////////////////////
			// Geolocation 'error' function
			////////////////////////////////////////
			function error(error) {
				alertify.error("Unable to determine your Geolocation")
			}
			////////////////////////////////////////


			//////////////////////////////
			/// clears map of infoWindow, Shapes and/or marker
			function clearMap() {

				// clear mafrkers
				if (typeof markers !== 'undefined') {
					for (counter = 0; counter < markers.length; counter++) {
						markers[counter].setMap(null);
					}
					markers = [];
				}

				map.data.forEach(function(feature) {
					map.data.remove(feature);
				})
			};
			//////////////////////////////
		});
		  	
	