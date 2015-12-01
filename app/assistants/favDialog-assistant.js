function FavDialogAssistant(sceneAssistant,action,dir,stpnm,stpid,rt) {
	this.sceneAssistant = sceneAssistant;
	this.action = action;
	this.dir = dir;
	this.stpnm = stpnm;
	this.stpid = stpid;
	this.rt = rt;
	this.widget;
	this.doActionHandler = this.doAction.bindAsEventListener(this);
}

FavDialogAssistant.prototype = {
	setup: function(widget){
		this.widget = widget;
		this.sceneAssistant.controller.get('fav-dialog-title').innerHTML = (this.action === 'add') ? 'Add to favorites' : 'Edit favorite';
		
		this.sceneAssistant.controller.setupWidget('fav-name', {
				multiline: false,
				autoReplace: false,
				autoFocus: true,
				maxLength: 30,
				focusMode: Mojo.Widget.focusSelectMode
			}, 
			{value: this.stpnm }
			//{value: (this.action==='add') ? [this.dir[0], this.stpnm].join(' - ') : this.stpnm } 
		);
		
		this.sceneAssistant.controller.setupWidget('okButton', {}, {
			label: 'Save'
		});
		this.sceneAssistant.controller.setupWidget('cancelButton', {}, {
			label: 'Cancel',
			buttonClass: 'dismiss'
		});
		
		this.sceneAssistant.controller.listen('okButton', Mojo.Event.tap, this.doActionHandler);
		this.sceneAssistant.controller.listen('cancelButton', Mojo.Event.tap, this.widget.mojo.close);
		
	},
	
	cleanup: function(event){
		this.sceneAssistant.controller.stopListening('okButton', Mojo.Event.tap, this.doActionHandler);
		this.sceneAssistant.controller.stopListening('cancelButton', Mojo.Event.tap, this.widget.mojo.close);
	},
	
	doAction: function(event){
	
		BT.db.transaction(function(tsc){
			var name = encodeURIComponent(this.sceneAssistant.controller.get('fav-name').mojo.getValue());
			if (this.action === 'add') {
		 		//tsc.executeSql('insert into favs values (?,?,?,?,?,-1)', [this.stpid, this.stpnm, this.rt, name, this.dir], this.tscSuccess.bind(this), this.tscFailure.bind(this));
				tsc.executeSql('insert into favorites values (?,?,?,?,?,-1)', [this.stpid, this.stpnm, this.rt, name, this.dir], this.tscSuccess.bind(this), this.tscFailure.bind(this));
			}
			else 
				//tsc.executeSql('update favs set name=? where stpid=? and rt=? and dir=?', [name, this.stpid, this.rt, this.dir], this.tscSuccess.bind(this), this.tscFailure.bind(this));
				tsc.executeSql('update favorites set name=? where stpid=? and rt=? and dir=?', [name, this.stpid, this.rt, this.dir], this.tscSuccess.bind(this), this.tscFailure.bind(this));
		}.bind(this));
		
		this.widget.mojo.close();
	},
	
	hideAddFavoriteButton: function(){
		this.sceneAssistant.commandMenuModel.items[0] = {};
		this.sceneAssistant.controller.modelChanged(this.sceneAssistant.commandMenuModel);
	},
	
	tscSuccess: function(tsc, res){
		var ac = this.sceneAssistant.controller.stageController.getAppController();
		if (this.action === 'add'){
			this.widget.mojo.close();
			ac.showBanner({messageText: 'Stop added to favorites.'},{});
			this.hideAddFavoriteButton();
	  	}
		
		else{
			ac.showBanner({messageText: 'Favorite successfully updated.'},{});
			if(this.sceneAssistant.shuffled) this.sceneAssistant.updateFavsIdx();
			this.sceneAssistant.getFavs();
		}
			
	},
	
	tscFailure: function(tsc, error){
		this.widget.hide();
		//Mojo.Log.info(error.code);
		var ac = this.sceneAssistant.controller.stageController.getAppController();
		if (error.message == 'constraint failed') {
			//this.sceneAssistant.controller.errorDialog("Stop already exists in the database!");
			ac.showBanner({messageText: "Stop already exists in the database!"},{});
			this.hideAddFavoriteButton();
		}
		else {
			//Mojo.Log.error("DB error",error.message);
			//this.sceneAssistant.controller.errorDialog("An error occured, try again");
			ac.showBanner({messageText: "An error occured, try again."},{});
			this.widget.show();
		}
	}
	
};
