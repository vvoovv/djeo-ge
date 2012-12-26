define([
	"dojo/_base/declare"
], function(declare) {

return declare(null, {
	
	init: function() {
		this.ge = this.map.engine.ge;
		this.balloon = this.ge.createHtmlStringBalloon('');
	},

	process: function(event){
		var feature = event.feature,
			cs = feature.reg.cs,
			balloon = this.balloon,
			content = cs.info ? cs.info(feature) : this.content(feature)
		;
		balloon.setContentString(content);
		balloon.setFeature(feature.baseShapes[0]);
		this.ge.setBalloon(balloon);
	}

});

});