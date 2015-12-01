function StopsAssistant(stopInfo){
	this.stopInfo = stopInfo;
	this.stopList = [];
	this.request;
	//models
	this.spinnerModel;
	this.stopListModel = {items: this.stopList};
	this.stopListCmdModel = {
		items: [{},{
			toggleCmd: 'sort',
			items: [
				{ label: "List", command: 'sort'},
				{ label: 'Map', command: 'show-map'}
			]
		},{}]
	};
	this.filterListModel = {disabled:false};
	//event handlers
	this.selectStopHandler = this.selectStop.bindAsEventListener(this);
	this.filterStartHandler = this.filterStart.bindAsEventListener(this);
	//map params
	this.userMarker;
	this.numReadings = 0;
	this.mapWrapper;
	this.locationTracker;
	//feedback
	this.scrim;
};

StopsAssistant.prototype = {
	setup: function() {
		this.controller.setupWidget(Mojo.Menu.appMenu,BT.appMenuAttr,BT.appMenuModel);
		this.controller.setupWidget(Mojo.Menu.commandMenu,{spacerHeight: 52, menuClass: 'no-fade'},this.stopListCmdModel);
		this.controller.setupWidget("spinner", {spinnerSize: "large"}, this.spinnerModel = {spinning: false});
		this.controller.setupWidget("stop-list",{
				itemTemplate: "stops/stop-list-item-tpl",
				renderLimit: 200
			},
			this.stopListModel
		);
		//Route filterList
		this.controller.setupWidget("stop-filter-list",
			{
				itemTemplate: "stops/stop-list-item-tpl",
				renderLimit: 200,
				filterFunction: this.filterStops.bind(this)
			},
			this.filterListModel
		);
		this.scrim = this.controller.get('stops-scrim');
		this.getStops();
		
		/* Event Handlers */
		this.controller.listen("stop-list",Mojo.Event.listTap,this.selectStopHandler);
		this.controller.listen("stop-filter-list",Mojo.Event.listTap,this.selectStopHandler);
		this.controller.listen("stop-filter-list",Mojo.Event.filter,this.filterStartHandler);
		this.mapWrapper = this.controller.get('stops-map-wrapper');
		
	},

	activate: function(){
		//if in map view, activate location services and set free orientation
		if(this.mapWrapper.style.display == 'block'){
			this.initTracker();
			this.controller.stageController.setWindowOrientation('free');
		}
	},
	
	deactivate: function(){
		//if in map view, cancel tracker and reset orientation
		if(this.mapWrapper.style.display == 'block'){
			this.controller.stageController.setWindowOrientation('up');
			this.locationTracker.cancel();
			BT.Mapper.centered = false;
		}
	},

	cleanup: function(event) {
		if(this.locationTracker) this.locationTracker.cancel();
		this.controller.stopListening("stop-list",Mojo.Event.listTap,this.selectStopHandler);
		this.controller.stopListening("stop-filter-list",Mojo.Event.listTap,this.selectStopHandler);
		this.controller.stopListening("stop-filter-list",Mojo.Event.filter,this.filterStartHandler);
		
		if (this.userMarker) {
	  		var pos = this.userMarker.getPosition();
	  		BT.Mapper.Lat = pos.lat();
	  		BT.Mapper.Lng = pos.lng();
	  		BT.Cookie.storeCookie(); //update last position
		}
		BT.Mapper.cleanup();
	},

	getStops: function(){
		var url = [BT.api_gateway,'getstops?',BT.api_key,'&rt=',this.stopInfo.rt,'&dir=',encodeURIComponent(this.stopInfo.dir)].join('');
		this.request = new Ajax.Request(url,{
			method: 'get',
			onCreate:  function(){
				this.scrim.style.display = 'block';
				this.spinnerModel.spinning=true;
				this.controller.modelChanged(this.spinnerModel);
			}.bind(this),
			onSuccess: this.populateStopList.bind(this),
			onFailure: function(){
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display = 'none';
				this.controller.errorDialog("Error retrieving stops");
			}.bind(this)
		});
	},

	populateStopList: function(transport){
		this.spinnerModel.spinning=false;
		this.controller.modelChanged(this.spinnerModel);
		this.scrim.style.display = 'none';
		
		var sx = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('stop');
		var ilat = 0.0;
		var ilon = 0.0;
		
		for(var i=0;i<sx.length;i++){
			ilat = parseFloat( sx[i].getElementsByTagName('lat').item(0).textContent );
			ilon = parseFloat( sx[i].getElementsByTagName('lon').item(0).textContent );
			this.stopList[i] = {
				stpid: sx[i].getElementsByTagName('stpid').item(0).textContent,
				stpnm: sx[i].getElementsByTagName('stpnm').item(0).textContent,
				lat: ilat,
				lon: ilon,
				dist: null
			};
		}
		if(this.stopList.length==0){
			this.controller.showAlertDialog({
				onChoose: function(value){ if(value===1) this.getStops(); },
				title: 'Error',
				message: 'Error retrieving Stops',
				choices: [
					{label:'Retry',value:1},
					{label:'Cancel',value:0, type:'dismiss'}
				]
			});
			return;
		}
		//refresh list
		this.stopListModel.items = this.stopList;
		this.controller.modelChanged(this.stopListModel);
	},

	selectStop: function(event){
		var prediction = {stpid:event.item.stpid, stpnm:event.item.stpnm, rt:this.stopInfo.rt,dir:this.stopInfo.dir };
		this.controller.stageController.pushScene({name:'predictions',templateModel:prediction},prediction);
	},

	filterStart: function(event) {
		if(event.filterString !== ''){
			this.controller.get('stop-list').style.display = 'none'
		}
		else{
			this.controller.get('stop-list').style.display = 'block'
		}
	},

	filterStops: function(filterString,listWidget,offset,count) {
		var subset = [];
		var totalSubsetSize = 0;
		this.filter = filterString;
		
		if( filterString !== ''){
			this.filteredStops = [];
			for(var i=0; i<this.stopList.length;i++){
				if( BT.hasString(filterString,this.stopList[i].stpnm) )
					this.filteredStops.push(this.stopList[i]);
			}
			
			for(var cursor=0;cursor<this.filteredStops.length;cursor++){
				if(subset.length < count && totalSubsetSize >= offset)
					subset.push(this.filteredStops[cursor]);
				++totalSubsetSize;
			}
		}
		//update list
		listWidget.mojo.noticeUpdatedItems(offset, subset);
		
		//update filter field count of items found
		listWidget.mojo.setCount(totalSubsetSize);
		listWidget.mojo.setLength(totalSubsetSize);	
	},

	sortStops: function() {
		this.scrim.style.display = 'block';
		this.spinnerModel.spinning=true;
		this.controller.modelChanged(this.spinnerModel);
				
		this.controller.serviceRequest("palm://com.palm.location",{
			method: 'getCurrentPosition',
			parameters: {accuracy:1},
			onSuccess: function(response){			
				BT.Mapperlocation = response;
				for( var i=0; i<this.stopList.length; i++){
					this.stopList[i].dist = this.calcDistance( this.stopList[i].lat, this.stopList[i].lon, response.latitude, response.longitude ) + " mi";
				}
				this.stopList.sort( this.sortFunc );
				this.controller.modelChanged(this.stopListModel);
				
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display = 'none';
			}.bind(this),
			onFailure: function(response){
				var ac = this.controller.stageController.getAppController();
	  			ac.showBanner({messageText: 'Error getting current position.'},{});
				
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display = 'none';
			}.bind(this)
		});
	},

	calcDistance: function(lat1,lon1,lat2,lon2){
		var R = 3958;
		lat1 = lat1 * Math.PI / 180;
		lon1 = lon1 * Math.PI / 180;
		lat2 = lat2 * Math.PI / 180;
		lon2 = lon2 * Math.PI / 180;
		var d =  ( Math.acos(Math.sin(lat1)*Math.sin(lat2) +  Math.cos(lat1)*Math.cos(lat2) * Math.cos(lon2-lon1)) * R );
		return d.toFixed(2);
	},
	
	listView: function(){
		//if returning from map view
		if(this.mapWrapper.style.display === 'block') {
			this.controller.stageController.setWindowOrientation('up');
			this.mapWrapper.style.display = 'none';
			this.controller.get('stops-header').style.display = 'block'
			BT.Mapper.centered = false;
			try {
				this.locationTracker.cancel();
			} catch (e) {}
			this.filterListModel.disabled = false;
			this.controller.modelChanged(this.filterListModel);
			
			if(this.spinnerModel.spinning){
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display = 'none';
			}
			
		}
		else{
			this.mapWrapper.style.display = 'none';
			this.sortStops();
		}
	},
	
	mapView: function(){
		//if already in list view, center map
		if (this.mapWrapper.style.display == 'block') {
			BT.Mapper.centered = false;
	  		return;
	  	}
		
		this.scrim.style.display = 'block';
		this.spinnerModel.spinning=true;
		this.controller.modelChanged(this.spinnerModel);
			
		this.mapWrapper.style.display = 'block';
		BT.Mapper.initialize(this.controller.get('stops-map'),this.markStops.bind(this));
		this.controller.get('stops-header').style.display = 'none';
		
		//disable filter list
		this.filterListModel.disabled = true;
		this.controller.modelChanged(this.filterListModel);		
		this.controller.stageController.setWindowOrientation('free');
	},

	handleCommand: function(event){
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
				case 'sort' :
					this.listView();
					break;
				
				case 'show-map' :
					this.mapView();
					break;
			}
		}
		if(event.type ==  Mojo.Event.back){
			//if currently in mapview switch to list view
			if(this.mapWrapper.style.display === 'block'){
				event.stop();
				var sortEvent = Mojo.Event.make(Mojo.Event.command,{'command':'sort'});
				this.controller.stageController.sendEventToCommanders(sortEvent);
				//update cmd menu
				this.stopListCmdModel.items[1].toggleCmd = 'sort';
				this.controller.modelChanged(this.stopListCmdModel);
			}
		}
	},

	sortFunc: function(a,b){
		if ( a.dist < b.dist ) return -1;
		if ( a.dist > b.dist ) return 1;
		return 0;
	},
	
	initTracker: function(){
		this.locationTracker = this.controller.serviceRequest('palm://com.palm.location',{
			method: 'startTracking',
			parameters: {subscribe:true},
			onSuccess: this.updateLocation.bind(this),
			onFailure: this.updateLocationFail.bind(this)
		});
	},

	markStops: function(){;
		var stopMarker, prediction, setupStopHandler;
		for(var i=0; i<this.stopList.length; i++){
			stopMarker = new google.maps.Marker({
				position: new google.maps.LatLng(this.stopList[i].lat, this.stopList[i].lon),
				map: BT.Mapper.map,
				icon: 'images/stop-marker.png'
			});
			prediction = {stpid:this.stopList[i].stpid,stpnm:this.stopList[i].stpnm,rt:this.stopInfo.rt,dir:this.stopInfo.dir};
			this.setupStopMarkers(stopMarker,prediction);
		}
		this.initTracker();
	},
	
	setupStopMarkers: function(marker,prediction){
		google.maps.event.addListener(marker,'click',function(){
			this.controller.showAlertDialog({
				onChoose: function(value) {
					if (value === 1) {
						this.controller.stageController.pushScene({name:'predictions',templateModel:prediction},prediction);
					}
				},
				allowHTMLMessage: true,
				message: '<div id="stop-dialog-name">'+prediction.stpnm+'</div><div class="stop-dialog palm-dialog-separator"></div>',
				choices: [
					{label: 'Track this stop', value:1},
					{label: 'Cancel', value:0, type:'dismiss'}
				]
			});
		}.bind(this));
	},
	
	updateLocation: function(position){
		var latlng = new google.maps.LatLng(position.latitude, position.longitude);
		
		if(!this.userMarker){
			var img = new google.maps.MarkerImage('images/dot.png',
				new google.maps.Size(12, 12), // size
				new google.maps.Point(0, 0), // origin
				new google.maps.Point(6, 6) // anchor
			);
			
			//draw marker
			this.userMarker = new google.maps.Marker({
				position: latlng,
				map: BT.Mapper.map,
				icon: img,
				flat: true,
				clickable:false,
				zIndex: 1000
			});
			
			//draw accuracy radius
			this.posAccuracy = new google.maps.Circle({
		   	center: latlng,
		   	fillColor: '#ccdeff',
		   	fillOpacity: 0.4,
		   	radius: position.horizAccuracy,
				map: BT.Mapper.map,
				strokeColor: '#85b3ff',
				strokeOpacity: 0.3,
				strokeWeight:2,
				clickable:false,
				zIndex:999
	  		});
			
			if(position.horizAccuracy < 350) {
		 		BT.Mapper.map.setCenter(latlng);
				BT.Mapper.centered = true;
				BT.Mapper.map.setZoom(15);
				
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display = 'none';
		 	}
		 	
		}
		else{
			this.userMarker.setPosition(latlng);
			this.posAccuracy.setCenter(latlng);
			this.posAccuracy.setRadius(position.horizAccuracy);

			if(BT.Mapper.centered == false){
				if(position.horizAccuracy < 350) {
						BT.Mapper.map.setCenter(latlng);
						BT.Mapper.centered = true;
						BT.Mapper.map.setZoom(15);
					if(this.spinnerModel.spinning == true) {
						this.spinnerModel.spinning=false;
						this.controller.modelChanged(this.spinnerModel);
						this.scrim.style.display = 'none';
					}
				}
			}	
		}
		return;
	},
	
	updateLocationFail: function(position){
		this.spinnerModel.spinning=false;
		this.controller.modelChanged(this.spinnerModel);
		this.scrim.style.display = 'none';
		
		this.stopListCmdModel.items[1].toggleCmd = 'sort';
		this.controller.modelChanged(this.stopListCmdModel);
			
		var message = '';
		var fatal = false;
		switch(position.errorCode){
			case 1:
			case 2:
			case 3:
			case 7:
				break;
			case 8:
				message = "This app is temporarily blacklisted";
				fatal = true;
				break;
			case 4:
				message = "GPS error, using cell/wifi";
			case 5:
				message = "Location service is off";
				fatal = true;
				break;
			case 6:
				message = "Permission denied";
				fatal = true;
				break;
				
			default: 
				break;
		}
		
		if(message!=''){
			var ac = this.controller.stageController.getAppController();
	  		ac.showBanner({messageText: message},{});
			if (fatal) this.listView();
		}
	}

};