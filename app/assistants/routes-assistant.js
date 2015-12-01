function RoutesAssistant() {
		
	this.routes = [];
	this.directions = [];
	this.request = null;
	
	//Widgets/Models
	this.routelistWidget = null;
	this.routeListModel = {items: this.routes};
	this.spinnerModel = {spinning: false};
	
	//Event handlers
	this.selectRouteHandler = this.selectRoute.bindAsEventListener(this);
	this.filterStartHandler = this.filterStart.bindAsEventListener(this);
	
	this.scrim;
	
}

RoutesAssistant.prototype = {

	setup: function() {
		//Route List
		this.controller.setupWidget("route-list",
			{
				itemTemplate: "routes/route-list-item-tpl",
				renderLimit: 200,
			},
			this.routeListModel
		);
		
		//Route filterList
		this.controller.setupWidget("route-filter-list",
			{
				itemTemplate: "routes/route-list-item-tpl",
				renderLimit: 140,
				filterFunction: this.filterRoutes.bind(this)
			},
			{}
		);
	
		this.controller.setupWidget(Mojo.Menu.appMenu,BT.appMenuAttr,BT.appMenuModel);
		
		BT.topViewMenuModel.items[0].toggleCmd = 'push-rts';
		this.controller.setupWidget(Mojo.Menu.viewMenu, BT.cmdMenuAttr, BT.topViewMenuModel);
		
		this.scrim = this.controller.get('routes-scrim');
		this.controller.setupWidget("spinner", {spinnerSize: "large"}, this.spinnerModel);
		this.controller.setupWidget("route-spinner",{modelProperty: "processing"});
		this.loadRoutes();
		
		//event handlers
		this.controller.listen("route-list",Mojo.Event.listTap,this.selectRouteHandler);
		this.controller.listen("route-filter-list",Mojo.Event.listTap,this.selectRouteHandler);
		this.controller.listen("route-filter-list",Mojo.Event.filter,this.filterStartHandler);
		
		this.routelistWidget = this.controller.get('route-list');
	},
	
	activate: Mojo.doNothing,
	deactivate: Mojo.doNothing,
	
	cleanup: function(event) {
		this.controller.stopListening("route-list",Mojo.Event.listTap,this.selectRouteHandler);
		this.controller.stopListening("route-filter-list",Mojo.Event.listTap,this.selectRouteHandler);
		this.controller.stopListening("route-filter-list",Mojo.Event.filter,this.filterStartHandler);
	},
	
	getRoutes : function(){
		Mojo.Log.info("getting routes from api");
		this.request = new Ajax.Request(BT.api_gateway+'getroutes?'+BT.api_key,{
			method: 'get',
			onSuccess: this.populateList.bind(this),
			onFailure: function(){
				this.spinnerModel.spinning=false;
				this.controller.modelChanged(this.spinnerModel);
				this.scrim.style.display='none';
				//show retry dialog
				this.controller.showAlertDialog({
					onChoose: function(value){ if(value===1) this.getRoutes(); },
					title: 'Error',
					message: 'Error retrieving Routes',
					choices: [
						{label:'Retry',value:1},
						{label:'Cancel',value:0, type:'dismiss'}
					]
				});
			}.bind(this)
		});
	},
	
	populateList : function(transport){
		//disable spinner
		this.spinnerModel.spinning=false;
		this.controller.modelChanged(this.spinnerModel);
		this.scrim.style.display='none';
	
		//parse xml  
		var rx = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('route');
		
		var limit =  rx.length;
		for(var i=0;i<limit;i++){
			this.routes[i] = {
				rt: rx[i].getElementsByTagName('rt').item(0).textContent,
				rtnm: rx[i].getElementsByTagName('rtnm').item(0).textContent,
				processing:false
			};
		}
		if(this.routes.length==0){
			this.controller.showAlertDialog({
				onChoose: function(value){ if(value===1) this.getRoutes(); },
				title: 'Error',
				message: 'Error retrieving Routes',
				choices: [
					{label:'Retry',value:1},
					{label:'Cancel',value:0, type:'dismiss'}
				]
			});
			return;
		}
		//refresh list
		this.routeListModel.items = this.routes;
		this.controller.modelChanged(this.routeListModel);
		this.storeRoutes(); //store routes to db
	},
	
	filterStart : function(event) {
		if(event.filterString !== ''){
			this.routelistWidget.hide();
		}
		else{
			this.routelistWidget.show();
		}
	},

	filterRoutes : function(filterString,listWidget,offset,count) {
		var subset = [];
		var totalSubsetSize = 0;
		this.filter = filterString;
		
		if( filterString !== ''){
			this.filteredRoutes = [];
			var push = false;
			for(var i=0; i<this.routes.length;i++){
				push = false;
				if( BT.hasString(filterString,this.routes[i].rt) ) push = true;
				else if( BT.hasString(filterString,this.routes[i].rtnm) ) push = true;
				if(push===true) this.filteredRoutes.push(this.routes[i]);
			}
			
			for(var cursor=0;cursor<this.filteredRoutes.length;cursor++){
				if(subset.length < count && totalSubsetSize >= offset)
					subset.push(this.filteredRoutes[cursor]);
				++totalSubsetSize;
			}
		}
		
		//update list
		listWidget.mojo.noticeUpdatedItems(offset, subset);
		
		//update filter field count of items found
		listWidget.mojo.setCount(totalSubsetSize);
		listWidget.mojo.setLength(totalSubsetSize);
		
	},

	loadRoutes : function(){
		this.scrim.style.display='block';
		this.spinnerModel.spinning=true;
		this.controller.modelChanged(this.spinnerModel);
				
		BT.db.transaction(
			function(tsc){
				tsc.executeSql('select * from routes',[],
					function(tsc,result){
						var len = result.rows.length;
						if(len==0) {
							this.getRoutes();
							return;
						}
						for(var i=0;i<len;i++){
							this.routes[i] = {
								rt: result.rows.item(i).rt,
								rtnm: result.rows.item(i).rtnm,
								dir: result.rows.item(i).dir
							}
						}
						this.spinnerModel.spinning=false;
						this.controller.modelChanged(this.spinnerModel);
						this.scrim.style.display='none';
	
						this.routeListModel.items = this.routes;
						this.controller.modelChanged(this.routeListModel);
						
					}.bind(this),
					function(tsc,error){
						Mojo.Log.error(error.code,":",error.message);
						if(error.code == 1) BT.setupDatabase();
						this.getRoutes();
					}.bind(this)
				);
			}.bind(this)
		);
	},
	
	storeRoutes : function() {
		var len = this.routes.length;
		BT.db.transaction(
			function(tsc){
				for(var i=0; i<len; i++)
					tsc.executeSql("insert into routes values(?,?,'u')",[this.routes[i].rt,this.routes[i].rtnm]);
			}.bind(this)
		);
			
	},
	
	setRouteDirections : function(rt){
		var value = 'u';
		if( this.directions[0].label[0] === 'E' || this.directions[0].label[0] === 'W') value = 'x';
		else if( this.directions[0].label[0] === 'N' || this.directions[0].label[0] === 'S') value = 'y';
		
		if( value === 'u') return; //assertion
		
		BT.db.transaction(
			function(tsc){
				tsc.executeSql('update routes set dir=? where rt=?',[value,rt]);
			}.bind(this)
		); 
	},
	
	selectRoute : function(event) {
		
		//this.controller.modelChanged(this.spinnerModel.spinning=false);
		//this.scrim.style.display='block'; //block UI
		
		var spinnerWidget = event.target.querySelectorAll('.palm-activity-indicator-small')[event.index];
		spinnerWidget.mojo.start();
		
		//attempt to get route directions from db
		this.directions = [];
		
		BT.db.transaction(
			function(tsc){
				Mojo.Log.info('checking db for route directions');
				tsc.executeSql("select dir from routes where rt=? and dir !='u'",[event.item.rt],
					function(tsc,result){
						var len = result.rows.length;
						if(len>0){
							if(result.rows.item(0).dir === 'x'){
								this.directions[0] = { label: 'East Bound', value: 'East Bound'};
								this.directions[1] = { label: 'West Bound', value: 'West Bound'};
							}
							else{
								this.directions[0] = { label: 'North Bound', value: 'North Bound'};
								this.directions[1] = { label: 'South Bound', value: 'South Bound'};
							}
							spinnerWidget.mojo.stop();
							this.scrim.style.display='none';
							Element.removeClassName(event.target.querySelector('.palm-row.selected'),'selected'); //proto
							this.showSelectRouteAlert(event.item.rt, event.item.rtnm);
						}
						else{
							this.getStopDirections(spinnerWidget,event);
						}
					}.bind(this),
					function(){
						this.getStopDirections(spinnerWidget,event);
					}.bind(this)
				)
			}.bind(this)
		); 
		
	},
	
	getStopDirections : function(spinnerWidget,event){
		var url = [BT.api_gateway,'getdirections?',BT.api_key,'&rt=',event.item.rt].join('');
		this.request = new  Ajax.Request(url,{
			method: 'get',
			onFailure: function(){
				// deactivate spinner
				spinnerWidget.mojo.stop();
				//this.scrim.style.display='none';
				Element.removeClassName(event.target.querySelector('.palm-row.selected'),'selected');
				Mojo.Controller.errorDialog("Error retrieving route directions");
			}.bind(this),
			
			onSuccess: function(transport){
				//deactivate spinner
				spinnerWidget.mojo.stop();
				this.scrim.style.display='none';
				Element.removeClassName(event.target.querySelector('.palm-row.selected'),'selected'); //proto
				var dx = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('dir');
			
				for(var i=0;i<dx.length;i++){
					this.directions[i] = {
						label: dx[i].textContent, value: dx[i].textContent
					};
				}
				
				if(this.directions.length==0){
					Mojo.Controller.errorDialog("Error processing route directions");
					return;
				}
				
				this.showSelectRouteAlert(event.item.rt, event.item.rtnm);
				this.setRouteDirections(event.item.rt);
							
			}.bind(this)
		});	
	},
	
	
	showSelectRouteAlert : function(rt,rtnm){
		this.controller.showAlertDialog({
	   	onChoose: function(value){
				if (value!=null){
					var stopInfo = {rt:rt,rtnm:rtnm,dir:value};
					this.controller.stageController.pushScene({name:'stops',templateModel:stopInfo},stopInfo);
				} 
	   	},
	   	title: rtnm,
	   	message: "Select route direction",
	   	choices: this.directions
	   });
	}
	
	
};