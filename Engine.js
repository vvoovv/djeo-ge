define([
	"require",
	"dojo/_base/declare", // declare
	"dojo/_base/lang", // hitch, isArray
	"dojo/_base/array", // forEach
	"dojo/aspect", // after
	"dojo/io/script", // get
	"dojo/_base/Deferred",
	"dojo/DeferredList",
	"djeo/Engine",
	"./Placemark",
	"djeo/util/_base"
], function(require, declare, lang, array, aspect, script, Deferred, DeferredList, Engine, Placemark, u){
	
var supportedLayers = {
	roadmap: 1,
	hybrid: 1,
	terrain: 1
}
globeEvents = {click: 1, mousemove: 1}
;

var GEngine = declare([Engine], {
	
	type: "ge",
	
	canRenderModels: true,

	// the result of google.earth.createInstance
	ge: null,
	
	constructor: function(kwArgs) {
		this._require = require;
		// set ignored dependencies
		lang.mixin(this.ignoredDependencies, {"Highlight": 1});
		this._supportedLayers = supportedLayers;
		// initialize basic factories
		this._initBasicFactories(new Placemark({
			map: this.map
		}));
	},
	
	initialize: function(/* Function */readyFunction) {
		if (window.google) {
			google.load("earth", "1", {callback: lang.hitch(this, function(){
				google.earth.createInstance(this.map.container, lang.hitch(this, function(instance){
					this.map.projection = "EPSG:4326";
					this.ge = instance;
					this.ge.getOptions().setMouseNavigationEnabled(false);
					this.ge.getWindow().setVisibility(true);
					
					this.initialized = true;
					readyFunction();
				}), function(){/*failure*/});
			})});
		}
		else if (this._initializing) {
			// Google JsAPI is being loaded
			// wait till initializing function is called
			aspect.after(this, "_initializing", lang.hitch(this, function(){
				this.initialize(readyFunction);
			}));
		}
		else {
			this._initializing = function(){};
			script.get({
				url: "https://www.google.com/jsapi",
				load: lang.hitch(this, function() {
					this._initializing();
					delete this._initializing;
					this.initialize(readyFunction);
				})
			});
		}
	},

	createContainer: function(feature) {
		var container = this.ge.createFolder('');
		this.appendChild(container, feature);
		return container;
	},
	
	prepare: function() {
		this.factories.Placemark.init();
	},
	
	appendChild: function(child, feature) {
		var parentContainer = feature.parent.getContainer();
		parentContainer.getFeatures().appendChild(child);
	},
	
	getTopContainer: function() {
		var features = this.ge.getFeatures();
		return this.ge;
	},
	
	onForFeature: function(feature, event, method, context) {
		var placemark = feature.baseShapes[0];
		// normalize the callback function
		method = this.normalizeCallback(feature, event, method, context);
		google.earth.addEventListener(placemark, event, method);
		return [placemark, event, method];
	},
	
	onForMap: function(event, method, context) {
		if (!(event in globeEvents)) return {remove: function(){}};
		var globe = this.ge.getGlobe(),
			callback =  function(e){
				method.call(context, {
					mapCoords: [e.getLongitude(), e.getLatitude()],
					nativeEvent: e
				});
			}
		;
		google.earth.addEventListener(globe, event, callback);
		return {
			remove: function(){
				google.earth.removeEventListener(globe, event, callback);
			}
		};
	},
	
	disconnect: function(connection) {
		google.earth.removeEventListener(/* placemark */connection[0], /* engineEvent */connection[1], /* method */connection[2]);
	},
	
	zoomTo: function(extent) {
		// The following code is derived from earth-api-utility-library (http://code.google.com/p/earth-api-utility-library/)
		// The earth-api-utility-library is licensed under the Apache License, Version 2.0

		var lookAtRange = 500, // the default lookat range to use when creating a view for a degenerate, single-point extent
			scaleRange = 1.5,
			aspectRatio = this.map.width/this.map.height,
			centerX = (extent[0]+extent[2])/2,
			centerY = (extent[1]+extent[3])/2,
			extentWidth = extent[2] - extent[0],
			extentHeight = extent[3] - extent[1];
		
		if (extentWidth || extentHeight) {
			var distEW = distance([extent[2], centerY], [extent[0], centerY]);
			var distNS = distance([centerX, extent[3]], [centerX, extent[1]]);
			aspectRatio = Math.min(Math.max(aspectRatio, distEW/distNS), 1.0);
			
			//experimentally derived distance formula
			var alpha = u.degToRad(45.0 / (aspectRatio + 0.4) - 2.0),
				expandToDistance = Math.max(distNS, distEW),
				beta = Math.min(u.degToRad(90), alpha + expandToDistance/(2*u.earthRadius));
			lookAtRange = scaleRange * u.earthRadius * (Math.sin(beta) * Math.sqrt(1 + 1 / Math.pow(Math.tan(alpha), 2)) - 1);
		}
		
		// get the current view
		var lookAt = this.ge.getView().copyAsLookAt(this.ge.ALTITUDE_RELATIVE_TO_GROUND);
		// set the position values
		lookAt.setLongitude(centerX);
		lookAt.setLatitude(centerY);
		lookAt.setAltitude(0);
		lookAt.setRange(lookAtRange);

		// update the view in Google Earth
		this.ge.getView().setAbstractView(lookAt);
	},
	
	destroy: function() {
		
	},
	
	executeBatch: function(batchFunction) {
		google.earth.executeBatch(this.ge, batchFunction);
	},
	
	enableLayer: function(layerId, enabled) {
		var ge = this.ge,
			lr = ge.getLayerRoot();
		switch (layerId.toLowerCase()) {
			case "roadmap":
			case "hybrid":
				lr.enableLayerById(ge.LAYER_BORDERS, enabled);
				lr.enableLayerById(ge.LAYER_ROADS, enabled);
				break;
			case "terrain":
				lr.enableLayerById(ge.LAYER_TERRAIN, enabled);
				break;
		}
	},
	
	renderFeatures: function(/* Array|Object */features, /* String? */theme, /* Boolean? */destroy) {
		// summary:
		//		Implementation of the renderFeatures method of djeo.Map
		var args = arguments;
		google.earth.executeBatch(this.ge, lang.hitch(this, function(){
			this.inherited("renderFeatures", args);
		}));
	},
	
	renderContainer: function(container, theme, destroy) {
		var deferred = new Deferred();
		google.earth.executeBatch(this.ge, lang.hitch(this, function(){
			var deferreds = this._renderContainer(container, theme, destroy);
			if (deferreds && deferreds.length) {
				var deferredList = new DeferredList(deferreds);
				deferredList.then(function(){
					deferred.resolve();
				});
			}
			else {
				// resolve deferred immediately
				deferred.resolve();
			}
		}));
		return deferred;
	},
	
	_renderContainer: function(container, theme, destroy) {
		if (!container.visible) return;
		if (container.features.length == 0 && destroy) {
			container.parent.numVisibleFeatures++;
		}
		var deferreds = [];
		array.forEach(container.features, function(feature){
			if (feature.isContainer || feature.visible) {
				var _deferreds = feature._render(theme, destroy);
				if (_deferreds) {
					if (lang.isArray(_deferreds)) {
						// FeatureContainer
						// copy elements from deferred to deferreds
						array.forEach(_deferreds, function(_deferred){
							deferreds.push(_deferred);
						});
					}
					else {
						// normal Feature (not a FeatureContainer)
						deferreds.push(_deferreds);
					}
				}
			}
		});
		return deferreds.length ? deferreds : null;
	}
});

var distance = function(point1, point2) {
	// The following code is derived from geojs library (http://code.google.com/p/geojs/)
	// The geojs library is licensed under the Apache License, Version 2.0
	
	// calculate angular distance between two points using the Haversine formula
	var phi1 = u.degToRad(point1[1]),
		phi2 = u.degToRad(point2[1]),
		d_phi = u.degToRad(point2[1] - point1[1]),
		d_lmd = u.degToRad(point2[0] - point1[0]),
		A = Math.pow(Math.sin(d_phi/2), 2) + Math.cos(phi1) * Math.cos(phi2) * Math.pow(Math.sin(d_lmd/2), 2),
		angularDistance = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
	return u.earthRadius * angularDistance;
};

return GEngine;
});