define([
	"dojo/_base/declare",
	"dojo/_base/lang", // hitch
	"dojo/_base/Deferred",
	"djeo/util/_base",
	"./_base"
], function(declare, lang, Deferred, u, e){

return declare(null, {
	
	constructor: function(kwArgs) {
		lang.mixin(this, kwArgs);
	},

	render: function(feature) {
		var engine = this.engine,
			ge = engine.ge,
			modelHref = feature.href,
			deferred = new Deferred()
		;

		modelHref = u.isRelativeUrl(modelHref) ? u.baseUrl+engine.map.modelBasePath+modelHref : modelHref;

		google.earth.fetchKml(ge, modelHref, lang.hitch(this, function(kmlFeature) {
			if (kmlFeature) {
				var kmlModel;
				// derived from KmlContainer
				if ( kmlFeature.getElementsByType) {
					kmlModel = kmlFeature.getElementsByType("KmlModel");
					kmlModel = kmlModel.getLength() ? kmlModel.item(0) : null;
				}
				else if (kmlFeature.getType()=="KmlPlacemark") {
					kmlModel = kmlFeature.getGeometry();
				}
				if (kmlModel) {
					if (e.altitudeModes[feature.altitudeMode]) kmlModel.setAltitudeMode(ge[e.altitudeModes[feature.altitudeMode]]);
					feature.baseShapes[0] = kmlModel;
					if (feature.coords) {
						feature._set_coords(feature.coords);
					}
					if (feature.orientation !== undefined) {
						feature._set_orientation(feature.orientation);
					}
					ge.getFeatures().appendChild(kmlModel.getParentNode());
				}
			}
			deferred.resolve();
		}));
		return deferred;
	},
	
	setCoords: function(coords, feature) {
		if (feature.map.renderModels) {
			this.setLocation(coords, feature);
		}
		else {
			this.engine.factories.Placemark.setCoords(coords, feature);
		}
	},
	
	setOrientation: function(orientation, feature) {
		if (feature.map.renderModels) {
			this._setOrientation(orientation, feature.baseShapes[0]);
		}
		else {
			var heading = this.orientation.heading;
			if (heading !== undefined) this.engine.factories.Placemark.rotate(setOrientation, feature);
		}
	},
	
	setLocation: function(location, feature) {
		var kmlModel = feature.baseShapes[0],
			kmlLocation = kmlModel.getLocation(),
			altitude = 0;
		if (location.length==3) altitude = location[2];
		kmlLocation.setLatLngAlt(location[1], location[0], altitude);
	},
	
	_setOrientation: function(orientation, kmlModel) {
		var kmlOrientation = kmlModel.getOrientation();
		if (orientation.heading !== undefined) {
			kmlOrientation.setHeading( u.radToDeg(orientation.heading) );
		}
	},
	
	remove: function(feature) {
		if (feature.map.renderModels) {
			var placemark = feature.baseShapes[0].getParentNode();
			placemark.getParentNode().getFeatures().removeChild(placemark);
		}
		else {
			this.engine.factories.Placemark.remove(feature);
		}
	}

});

});

