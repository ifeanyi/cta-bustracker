function PredictionsAssistant(prediction) {
	this.prediction = prediction;
	this.predictionsList = [];
	this.request = null;
	this.metaTap = false;
	this.scrim;
	
	//Models
	this.pListModel = { items: this.predictionsList };
	this.secRadioModel={value:BT.defaultPredictions};
	this.commandMenuModel = {
		items: [
			{},{icon: 'refresh',command:'refresh-predictions'}
		]
	};
	this.predictionsListToggleHandler = this.togglePredictions.bindAsEventListener(this);
}

PredictionsAssistant.prototype = {
	setup: function() {
		this.controller.setupWidget(Mojo.Menu.appMenu,BT.appMenuAttr,{
			visible: true,
			items: [
				{label: 'Open New Card', command: 'open-new-card', disabled:false},
				{label: 'Preferences', command:'do-prefs', disabled:false},
				{label: 'Help', command:'do-support', disabled:false}
			]}
		);
		this.controller.setupWidget("spinner", {spinnerSize: "large"}, this.spinnerModel = {spinning: false});
		this.controller.setupWidget("prediction-list",
			{
				itemTemplate: "predictions/prediction-list-item-tpl",
			},
			this.pListModel
		);
		
		this.controller.setupWidget("predictions-radio",
			{
				choices: [
					{label: 'All Routes', value:1},
					{label: this.prediction.rt+' only', value:2}
				]
			},
			this.secRadioModel
		);		
		this.controller.setupWidget(Mojo.Menu.commandMenu,
			{
				spacerHeight: 52, menuClass: 'no-fade'
			},
			this.commandMenuModel
		);
		
		this.scrim = this.controller.get('predictions-scrim');
		this.scrim.style.webkitPalmMouseTarget='ignore';
		
		this.controller.listen("predictions-radio",Mojo.Event.propertyChange,this.predictionsListToggleHandler);
		this.controller.listen(this.controller.topContainer(),Mojo.Event.keyup,this.interrogateKeyup.bindAsEventListener(this));
		this.controller.listen(this.controller.topContainer(),Mojo.Event.keydown,this.interrogateKeydown.bindAsEventListener(this));
		this.getPredictions();
		this.checkFavs();
	
	},
	
	activate: Mojo.doNothing,
	deactivate: Mojo.doNothing,
	
	cleanup: function(event) {
		this.controller.stopListening("predictions-radio",Mojo.Event.propertyChange,this.predictionsListToggleHandler);
		this.controller.stopListening(this.controller.topContainer(),Mojo.Event.keyup,this.interrogateKeyup.bindAsEventListener(this));
		this.controller.stopListening(this.controller.topContainer(),Mojo.Event.keydown,this.interrogateKeydown.bindAsEventListener(this));
	},
	
	togglePredictions: function(event){		
		//show all routes
		var extras = this.controller.get('prediction-list').querySelectorAll('.sec');
		
		if(extras.length > 0)
			this.controller.get('null-sked').style.display = 'none';
	
		if(event.value == 1){
			for(var i=0;i<extras.length;i++)
				extras[i].className = 'BT-row palm-row sec';	
		}
		//switch to limited view
		else{
			for(var i=0;i<extras.length;i++)
				extras[i].className = 'BT-row palm-row sec hidden ';
			
			if( extras.length == this.predictionsList.length)
				this.controller.get('null-sked').style.display = 'block';
		}		
	},
	
	getPredictions: function() {
		var url = [BT.api_gateway,'getpredictions?',BT.api_key,'&stpid=',this.prediction.stpid,'&dir=',escape(this.prediction.dir),'&top=8'].join('');
		this.request = new Ajax.Request(url,{
			method: 'GET',
			onCreate:  this.createRequestHandler.bind(this),
			onSuccess: this.populatePredictionsList.bind(this),
			onFailure: this.failedRequestHandler.bind(this)
		});
	},
	
	createRequestHandler: function(){
		this.scrim.style.display='block';
		this.spinnerModel.spinning=true;
		this.controller.modelChanged(this.spinnerModel); 
	},
	
	failedRequestHandler: function(){
		this.spinnerModel.spinning=false;
		this.controller.modelChanged(this.spinnerModel);
		this.scrim.style.display = 'none';
		//this.controller.errorDialog("Error retrieving estimates, retry");
		this.controller.stageController.getAppController().showBanner({messageText: "Error retrieving estimates, retry"},{});
	},
	
	populatePredictionsList: function(transport){
		//Mojo.Log.info("populating list");
		this.spinnerModel.spinning=false;
		this.controller.modelChanged(this.spinnerModel);
		this.scrim.style.display = 'none';
		
		var px = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('prd');
		var secClass = (this.secRadioModel.value == 1 ) ? 'sec' : 'sec hidden';
		//Mojo.Log.info(transport.responseText);
		var sysTm = new Date();
		var prdTm = new Date();
		var priRtCount = 0;
		this.predictionsList = []; //clear predictions
			
		for(var i=0;i<px.length;i++){
			if( px[i].getElementsByTagName('typ').item(0).textContent !== 'A' ) continue;
			var _rt = px[i].getElementsByTagName('rt').item(0).textContent;
			var _prdtm = px[i].getElementsByTagName('prdtm').item(0).textContent;
		
			prdTm.setFullYear( parseInt(_prdtm.substr(0,4),10), (parseInt(_prdtm.substr(4,2),10))-1, parseInt(_prdtm.substr(6,2),10) );
			prdTm.setHours( parseInt(_prdtm.substr(9,2),10), parseInt(_prdtm.substr(12,2),10) );
			
			this.predictionsList[i] = {
				prdtm: this.estimateToString(sysTm,prdTm),
				rt: _rt,
				rtClass: (_rt !== this.prediction.rt) ? secClass : '',
				vid: px[i].getElementsByTagName('vid').item(0).textContent,
				des: px[i].getElementsByTagName('des').item(0).textContent,
				open: false
			};
			if( _rt === this.prediction.rt) ++priRtCount;
		}
		
		if( priRtCount < 1 && this.secRadioModel.value == 2 )
			this.controller.get('null-sked').style.display='block';
						
		if( priRtCount > 1)
			this.controller.get('null-sked').style.display='none';
	
		if(this.predictionsList.length==0){
			this.controller.get('null-sked').style.display='block';		
			var emg = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('msg');
			if(emg.length>0){
				this.controller.errorDialog(emg[0].textContent);
				return;
			}
			
		}
		
		//refresh list
		this.pListModel.items = this.predictionsList;
		this.controller.modelChanged(this.pListModel);
	},
	
	
	estimateToString: function(sysTm,prdTm) {
		var diff = ( (prdTm - sysTm) - BT.sysOffset ) / 1000;	
		if( Math.floor(diff/60) <= 1) return 'approaching';
		return Math.floor(diff/60) + ' minutes';			
	},
	
	handleCommand: function(event) {			
		if(event.type == Mojo.Event.command){
			switch(event.command){
				case 'refresh-predictions' :
					if(this.metaTap == true){
						this.metaTap = false;
						BT.launchNewPredictionStage(this.controller.stageController, this.prediction);
					}
					else this.getPredictions();
					break;
					
				case 'open-new-card' :
					BT.launchNewPredictionStage(this.controller.stageController, this.prediction);
					break;
					
				case 'add-fav' :
					this.controller.showDialog({
						template: 'favorites/add-edit-favorites-tpl',
						assistant: new FavDialogAssistant(this,'add', this.prediction.dir, this.prediction.stpnm, this.prediction.stpid, this.prediction.rt), 
						preventCancel: false
					});
				  	break;
			}
		}
	},
	
	checkFavs: function() { 
		BT.db.transaction(
			function(tsc){
				tsc.executeSql('select count(*) as num from favorites where stpid=? and rt=? and dir=?',
					[this.prediction.stpid,this.prediction.rt,this.prediction.dir],
					function(tsc,result){
						if(result.rows.item(0).num == 0){
							this.commandMenuModel.items[0] = {icon: 'new', command: 'add-fav'};
							this.controller.modelChanged(this.commandMenuModel);
						}
					}.bind(this)
				)
			}.bind(this)
		);
	},
	
	interrogateKeydown: function(event){
		if(event.keyCode === Mojo.Char.metakey) this.metaTap = true;
	   return;
	},
	
	interrogateKeyup: function(event){
		if(event.keyCode === Mojo.Char.metakey) this.metaTap = false;
	   return;
	}

};