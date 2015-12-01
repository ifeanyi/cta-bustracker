/*
 * BT namespace
 */

BT = {
	api_gateway : 'http://www.ctabustracker.com/bustime/api/v1/',
   api_key : 'key=DYqc22EmQv73B4sSCSH6qVUrm', 
	hasString : function(query,s){
		if( s.toUpperCase().indexOf(query.toUpperCase()) >=0 ) return true;
		return false;
	},
	cmdMenuAttr : { spacerHeight: 0, menuClass: 'no-fade'},
	appMenuAttr: { omitDefaultItems: true, },
	appMenuModel : {
		visible: true,
		items: [
			{label: 'Preferences', command:'do-prefs', disabled:false},
			{label: 'Help', command:'do-support', disabled:false}
		]
	},
	
	topViewMenuModel : {
		items:[
			{
				items: [
					{label: 'All Routes', command: 'push-rts', width:160},
					{label: 'Favorites', command: 'push-favs', width:160}
				]
			}
		]
	},
	//default globals
	startScene : 'routes', //default value
	defaultPredictions : 2, //1: all & 2: primary
	initRun : false,
	versionString: '',
	sysOffset : 0,
	theme: '',
	Cookie : ({
		initialize:  function(){
			this.data = new Mojo.Model.Cookie('BTPrefs');
			var oldBTPrefs = this.data.get();
			
			if(oldBTPrefs){
				BT.startScene = (oldBTPrefs.startScene) ? oldBTPrefs.startScene : BT.startScene;
				BT.initRun = false;
				BT.versionString = (oldBTPrefs.versionString) ? oldBTPrefs.versionString : BT.versionString;
				BT.theme = (oldBTPrefs.theme) ? oldBTPrefs.theme : BT.theme;
				BT.Mapper.Lng = (oldBTPrefs.last_position_lng) ? oldBTPrefs.last_position_lng : BT.Mapper.Lng;
				BT.Mapper.Lat = (oldBTPrefs.last_position_lat) ? oldBTPrefs.last_position_lat : BT.Mapper.Lat;
				BT.defaultPredictions = (oldBTPrefs.defaultPredictions) ? oldBTPrefs.defaultPredictions : BT.defaultPredictions;
			}
			
			if(  BT.versionString !== Mojo.appInfo.version ) BT.initRun = true;
			//Mojo.Log.info( "v", BT.versionString, "run", BT.initRun );
			this.storeCookie();
		},
		storeCookie: function(){
			this.data.put({
				startScene: BT.startScene,
				initRun: false,
				versionString: Mojo.appInfo.version,
				theme: BT.theme,
				defaultPredictions: BT.defaultPredictions,
				last_position_lng: BT.Mapper.Lng,
				last_position_lat: BT.Mapper.Lat
			});
		}
	}),
	db : openDatabase('ChicagoBusTracker'), //database connection
	
	setupDatabase : function(){
		Mojo.Log.info("creating tables");
		this.db.transaction(function(tsc){
			tsc.executeSql('drop table if exists routes'); 
			tsc.executeSql('create table if not exists favorites (stpid,stpnm,rt,name,dir,idx, primary key(stpid,rt,dir) )');
			tsc.executeSql('create table if not exists routes (rt primary key,rtnm,dir)');
		});
		this.Cookie.storeCookie();
	},
	
	upgradeDatabase: function(){
		Mojo.Log.info("Upgrading database");
		this.db.transaction(function(tsc){
			tsc.executeSql('create table if not exists favorites (stpid,stpnm,rt,name,dir,idx, primary key(stpid,rt,dir) )');
			tsc.executeSql('insert into favorites select * from favs');
			tsc.executeSql('drop table if exists favs');
		});
	},
	
	launchNewPredictionStage: function(stageController,prediction){
		var desiredStageName = prediction.stpid+prediction.dir;
		var appController = stageController.getAppController();
		if (desiredStageName == stageController.window.name) return; //quit if it is current stage
		//check if desired stage already exists
		var liveStage = appController.getStageController(desiredStageName);
		if(liveStage){
			appController.getActiveStageController().popScene();
	  		liveStage.activate(); //.popScenesTo('predictions');
	  		return;
		}
		//actually create a new stage
		var setupPredictionStage = function(stageController){
	  		Element.addClassName(stageController.document.body, BT.theme);
	  		stageController.pushScene({name: 'predictions',templateModel: prediction}, prediction);
		};
		appController.getActiveStageController().popScene();
		appController.createStageWithCallback({name:desiredStageName,lightweight:true},setupPredictionStage,'card');	
	},
	
	Mapper : ({
		node: null,
		map: null,
		Lat: 41.89245435204155,
		Lng: -87.62422800064087,
		location: null,
		callback: null,
		scene: null,
		centered: false,
		initialize : function(node,callback){
			this.callback = callback;
			this.node = node;
			this.centered = false;
			if( typeof(google) == 'undefined' || typeof(google.maps) == 'undefined') this.load();
			else if(this.map == null) this.setup();
			else this.callback();
		},
		load: function(){
			var script = document.createElement('script');
		  	script.src = 'http://maps.google.com/maps/api/js?sensor=true&callback=BT.Mapper.setup';
		  	script.type = 'text/javascript';
			document.body.appendChild(script); /*HACK*/
		},
		setup: function(){
			var last = new google.maps.LatLng(this.Lat,this.Lng);
			this.map = new google.maps.Map( this.node, {
				zoom:14,
				center: last,
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				disableDefaultUI:true,
			});
			
			//Zoom Controls
			var ctrl_container = this.node.ownerDocument.createElement('div');
			ctrl_container.id = 'BT-map-ctrl-container';
			ctrl_container.index = 1;
			
			var zoom_in_ctrl = this.node.ownerDocument.createElement('div');
			var zoom_out_ctrl = this.node.ownerDocument.createElement('div');
			zoom_in_ctrl.className = zoom_out_ctrl.className = 'BT-map-ctrl';
			
			ctrl_container.appendChild(zoom_in_ctrl);
			ctrl_container.appendChild(zoom_out_ctrl);
			
			this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(ctrl_container);
			
			//MapType Controls
			var m_ctrl_container = this.node.ownerDocument.createElement('div');
			m_ctrl_container.id = 'BT-maptype-ctrl-container';
			m_ctrl_container.index = 2;
			
			var curMapType = this.node.ownerDocument.createElement('div');
			curMapType.id = 'BT-cur-maptype'; 
			curMapType.textContent = this.map.getMapTypeId();
			
			var roadmapCtrl = this.node.ownerDocument.createElement('div');
			roadmapCtrl.textContent = google.maps.MapTypeId.ROADMAP;
			
			var satmapCtrl = this.node.ownerDocument.createElement('div');
			satmapCtrl.textContent = google.maps.MapTypeId.SATELLITE;
			
			var hybridmapCtrl = this.node.ownerDocument.createElement('div');
			hybridmapCtrl.textContent = google.maps.MapTypeId.HYBRID;
			
			roadmapCtrl.className = satmapCtrl.className = hybridmapCtrl.className = 'BT-maptype-ctrl';
			
			m_ctrl_container.appendChild(curMapType);
			m_ctrl_container.appendChild(roadmapCtrl);
			m_ctrl_container.appendChild(satmapCtrl);
			m_ctrl_container.appendChild(hybridmapCtrl);
			
			this.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(m_ctrl_container);
			/*
			this.gestureStartHandler = this.gestureStart.bind(this);
			this.gestureChangeHandler = this.gestureChange.bind(this);
			this.gestureEndHandler = this.gestureChange.bind(this);
			*/
			this.zoomInHandler = this.zoomInMap.bind(this);
			this.zoomOutHandler = this.zoomOutMap.bind(this);
			this.mapTypeHandler = this.changeMapType.bind(this);
			/*
			this.scene = Mojo.Controller.stageController.activeScene();
			this.scene.listen(this.node, "gesturestart", this.gestureStartHandler );
			this.scene.listen(this.node, "gesturechange", this.gestureChangeHandler );
			this.scene.listen(this.node, "gestureend", this.gestureEndHandler );
			*/
			
			google.maps.event.addDomListener(zoom_in_ctrl,'click', this.zoomInHandler );
			google.maps.event.addDomListener(zoom_out_ctrl,'click', this.zoomOutHandler );
			google.maps.event.addDomListener(m_ctrl_container,'click',this.mapTypeHandler);

			this.callback();
		},
		
		changeMapType : function(event){
			if(event.target.className == 'BT-maptype-ctrl'){
				event.target.style.backgroundColor = '#222';
				this.map.setMapTypeId(event.target.textContent);
				this.node.querySelector('#BT-cur-maptype').textContent = event.target.textContent;
				
				var options = this.node.querySelectorAll('.BT-maptype-ctrl');
				for(var i=0; i<3; i++ ) options[i].style.display = 'none';
				event.target.style.backgroundColor = '';
			}
			else{
				var options = this.node.querySelectorAll('.BT-maptype-ctrl');
				for(var i=0; i<3; i++ ) 
					options[i].style.display = (options[i].style.display=='block') ? 'none' : 'block';
			}
		},
		/*
		gestureStart: function(event){
			this.map.setOptions({draggable:false});
			this.previousScale=event.scale;
		},
		gestureChange:function(event){
			event.stop();
			var d=this.previousScale-event.scale;
			if(Math.abs(d)>0.25){
				var z= this.map.getZoom()+ ( d>0 ? -1: +1);
				this.map.setZoom(z);
				this.previousScale=event.scale;
			}
		},
		gestureEnd:function(event){
			event.stop();
		},
		*/
		zoomInMap: function(){
			this.map.setZoom( this.map.getZoom() + 1 );
		},
		zoomOutMap: function(){
			this.map.setZoom( this.map.getZoom() - 1 );
		},
		setMapType: function(event){
			this.map.setMapTypeId(event.target.textContent);
		},
		cleanup: function(){
			if (this.map != null){
			 	this.map = null;
				/*
			 	this.scene.stopListening(this.node, "gesturestart", this.gestureStartHandler );
				this.scene.stopListening(this.node, "gesturechange", this.gestureChangeHandler );
				this.scene.stopListening(this.node, "gestureend", this.gestureEndHandler );
				*/
			}
		}	
	})
	
};