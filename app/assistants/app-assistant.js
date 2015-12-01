function AppAssistant(appController){}

AppAssistant.prototype = {
	handleLaunch: function(params){
		var mainStageController = this.controller.getStageController('main');
		if(!params){
			if(mainStageController){
				mainStageController.activate();
			}
			else{
				var setupMainStage = function(mainStageController){
					BT.Cookie.initialize();
					if(BT.versionString.length > 0 && BT.versionString[2] == "1") BT.upgradeDatabase(); //if version 1.1**
					//Synchronize time
					var url = [BT.api_gateway, 'gettime?', BT.api_key].join('');
					var request = new Ajax.Request(url, {
						onSuccess: this.syncTime.bind(this)
					});
					//create databases if initial run
					if (BT.initRun === true) BT.setupDatabase();
					//add theme style
					Element.addClassName(mainStageController.document.body,BT.theme);
					mainStageController.pushScene(BT.startScene);
				}.bind(this);
				this.controller.createStageWithCallback({name:'main',lightweight:true},setupMainStage,'card');
			}
		}
		else{
			//TODO
		}
	},
	
	syncTime: function(transport){
		var localTime = new Date();
		var ctaTime = new Date();
		var tx = new DOMParser().parseFromString(transport.responseText, "text/xml").querySelectorAll('tm');
		if (tx.length != 0) {
			var tm = tx[0].textContent;
			ctaTime.setFullYear(parseInt(_prdtm.substr(0, 4), 10), (parseInt(_prdtm.substr(4, 2), 10)) - 1, parseInt(_prdtm.substr(6, 2), 10));
			ctaTime.setHours(parseInt(tm.substr(9, 2), 10), parseInt(tm.substr(12, 2), 10), parseInt(tm.substr(15, 2), 10));
			BT.sysOffset = ctaTime - localTime;
			//Mojo.Log.info("Time offset", BT.sysOffset); //Log
		}
	},
	
	handleCommand: function(event){
		var activeStage = this.controller.getActiveStageController('card');
		if (event.type == Mojo.Event.command) {
			switch (event.command) {
				case "push-rts":
				case "push-favs":
					var s = activeStage.activeScene();
					var dest = ( event.command == 'push-rts') ? 'routes' : 'favorites';
					if(dest==s.sceneName) return;
					activeStage.swapScene({
						name: dest,
						transition: Mojo.Transition.none
					});
					break;
				case 'do-prefs':
					this.pushInfoScene(activeStage,'preferences');
					break;
				case 'do-support':
					this.pushInfoScene(activeStage,'support');
					//activeStage.pushAppSupportInfoScene();
					break;
				default: 
					break;
			}
		}
	},
	
	pushInfoScene: function(stageController,name){
		var act = stageController.activeScene();
		if (act.sceneName === 'info'  ){
			stageController.swapScene('info', name);
		} 
		else{
			stageController.pushScene('info', name);
		}
	},
};
