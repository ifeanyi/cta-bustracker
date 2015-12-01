function InfoAssistant(view) {
	this.view = view;
};

InfoAssistant.prototype = {

	setup : function() {
		var tpl = ['info/',this.view,'-tpl'].join('');
		var content = Mojo.View.render({
	   	template: tpl,
			object: Mojo.appInfo
	   });
		this.controller.get('content').innerHTML = content;
		
		if (this.view === 'preferences') {
			//disable preferences option
			BT.appMenuModel.items[0].disabled = true;
	   	this.controller.setupWidget('startup-opt', 
				{
		   		choices: [
						{label: 'Routes',value: 'routes'}, 
						{label: 'Favorites',value: 'favorites'}
					],
		   		label: 'Scene',
					labelPlacement: Mojo.Widget.labelPlacementLeft
		   	
		   	}, 
				{value: BT.startScene}
			);
			
			this.controller.setupWidget('prd-opt',{
					choices: [
						{label:'All Routes', value: 1},
						{label:'Primary Route', value: 2 }
					],
					label:'Default',
					labelPlacement: Mojo.Widget.labelPlacementLeft
				}, 
				{value: BT.defaultPredictions}
			);
			
			this.controller.setupWidget('theme-opt', 
				{
		   		choices: [
						{label: 'Classic',value: 1}, 
						{label: 'Goldie Sox',value: 2}
					],
		   		label: 'Theme',
					labelPlacement: Mojo.Widget.labelPlacementLeft
		   	
		   	}, 
				{value: (BT.theme == '' || typeof(BT.theme) == 'undefined') ? 1 : 2 }
			);
			
			this.controller.listen('startup-opt',Mojo.Event.propertyChange, this.updateStartScene.bindAsEventListener(this) );
			this.controller.listen('theme-opt',Mojo.Event.propertyChange, this.updateTheme.bindAsEventListener(this) );
			this.controller.listen('prd-opt',Mojo.Event.propertyChange, this.updateDefaultPredictions.bindAsEventListener(this) );
			this.controller.setupWidget('clr-rt',Mojo.Widget.Button,{label:'Clear Routes cache'},{});
			this.controller.listen('clr-rt',Mojo.Event.tap,this.clearRouteCache.bindAsEventListener(this));
		}
		else if(this.view === 'support') 
			BT.appMenuModel.items[1].disabled = true;
		
		this.controller.setupWidget(Mojo.Menu.appMenu,BT.appMenuAttr,BT.appMenuModel);
		
	},
	
	activate : Mojo.doNothing,
	
	deactivate : function(event) {
		if (this.view === 'preferences') BT.Cookie.storeCookie();
	},
	
	cleanup : function(event) {
		if (this.view === 'preferences') {
			BT.appMenuModel.items[0].disabled = false;
	   	this.controller.stopListening('startup-opt', Mojo.Event.propertyChange, this.updateStartScene.bindAsEventListener(this));
			this.controller.stopListening('theme-opt',Mojo.Event.propertyChange, this.updateTheme.bindAsEventListener(this) );
			this.controller.stopListening('clr-rt',Mojo.Event.tap,this.clearRouteCache.bindAsEventListener(this));
			this.controller.stopListening('prd-opt',Mojo.Event.propertyChange, this.updateDefaultPredictions.bindAsEventListener(this) );
	   }
		else if( this.view === 'support' )
			BT.appMenuModel.items[1].disabled = false;
	},
	
	updateStartScene : function(event) {
		BT.startScene = event.value;
	},
	
	updateDefaultPredictions : function(event){
		BT.defaultPredictions = event.value;
	},
	
	updateTheme : function(event){
		if(event.value==1){
			Element.removeClassName(this.controller.document.querySelector('body'),'bt-dark'); 
			Mojo.Log.info('removing dark theme');
			BT.theme = '';
		}
		else{
			Element.addClassName(this.controller.document.querySelector('body'),'bt-dark');
			BT.theme = 'bt-dark';
		}
		
	},
	
	clearRouteCache : function(event){
		var widget = this.controller.get('clr-rt');
		var winfo =  this.controller.get('clr-rt-info');
		BT.db.transaction(
			function(tsc){
				tsc.executeSql('delete from routes',[],
					function(tsc,result){
						winfo.innerHTML = 'Relaunch to apply changes';
						winfo.style.color = '#d51007';
						winfo.style.textAlign = 'center';
					}.bind(this)
				);
			}.bind(this)
		);
	}

};