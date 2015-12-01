function FavoritesAssistant() {
	this.favs = [];
	this.favListModel = {items: this.favs};
	this.favListWidget;
	this.metaTap = false;
	
	//event handlers
	this.favListDelHandler = this.removeFav.bindAsEventListener(this);
	this.favListReorderHandler = this.reorderFavs.bindAsEventListener(this);
	this.selectFavHandler = this.selectFav.bindAsEventListener(this);
};

FavoritesAssistant.prototype = {
	setup : function() {
		//set up list widget
		this.controller.setupWidget('favorite-list',
			{
				itemTemplate: 'favorites/favorite-list-item-tpl',
				swipeToDelete: true,
				hasNoWidgets: true,
				fixedHeightItems: true,
				reorderable:true
			},
			this.favListModel
		);
		
		BT.topViewMenuModel.items[0].toggleCmd = 'push-favs';
		this.controller.setupWidget(Mojo.Menu.viewMenu,BT.cmdMenuAttr,BT.topViewMenuModel);
		
		this.controller.setupWidget(Mojo.Menu.appMenu,BT.appMenuAttr,BT.appMenuModel);
		
		//event handlers
		this.controller.listen('favorite-list',Mojo.Event.listDelete,this.favListDelHandler);
		this.controller.listen('favorite-list',Mojo.Event.listReorder,this.favListReorderHandler);
		this.controller.listen('favorite-list',Mojo.Event.listTap,this.selectFavHandler);
		this.controller.listen(this.controller.topContainer(),Mojo.Event.keyup,this.interrogateKeyup.bindAsEventListener(this));
		this.controller.listen(this.controller.topContainer(),Mojo.Event.keydown,this.interrogateKeydown.bindAsEventListener(this));
		
		//load favs
		this.getFavs();
		this.favListWidget = this.controller.get('favorite-list');
	},

	activate : Mojo.doNothing,
	deactivate: Mojo.doNothing,
	
	cleanup : function(event) {
		this.controller.stopListening('favorite-list',Mojo.Event.listDelete,this.favListDelHandler);
		this.controller.stopListening('favorite-list',Mojo.Event.listReorder,this.favListReorderHandler);
		this.controller.stopListening('favorite-list',Mojo.Event.listTap,this.selectFavHandler);
		this.controller.stopListening(this.controller.topContainer(),Mojo.Event.keyup,this.interrogateKeyup.bindAsEventListener(this));
		this.controller.stopListening(this.controller.topContainer(),Mojo.Event.keydown,this.interrogateKeydown.bindAsEventListener(this));
	},
	
	getFavs : function(){
		BT.db.transaction( 
			function(tsc){
				tsc.executeSql('select * from favorites order by idx asc', [], this.loadFavs.bind(this), this.loadFavsFail.bind(this) );
			}.bind(this)
		);
	},

	removeFav : function(event){
		BT.db.transaction(
			function(tsc){
				tsc.executeSql('delete from favorites where name = ?', [encodeURIComponent(event.item.name)]);
				this.showNullPlaceholder();
		  	}.bind(this)
		);
		
	},

	reorderFavs : function(event){
		var item = this.favs[event.fromIndex];
		this.favs.splice(event.fromIndex,1);
		this.favs.splice( (Math.max(0,event.toIndex)) ,0,item);
		this.updateFavsIdx();
	},
	
	updateFavsIdx : function(){
		Mojo.Log.info("updating favsIdx");
		BT.db.transaction(
			function(tsc){
				for(var i=0;i<this.favs.length;i++){
					tsc.executeSql('update favorites set idx = ? where stpid=? and rt=? and dir=?', [i, this.favs[i].stpid, this.favs[i].rt, this.favs[i].dir] );
				}
			}.bind(this)
		);
		//this.shuffled = false;
	},
	
	selectFav : function(event){
		if(this.metaTap===true) {
			this.metaTap = false;
			this.controller.showDialog({
				template: 'favorites/add-edit-favorites-tpl',
				assistant: new FavDialogAssistant(this,'edit',event.item.dir,event.item.name,event.item.stpid,event.item.rt), //dir,stpnm,stpid,rt
				preventCancel: false
			});
		}
		else{
			var prediction = {stpid:event.item.stpid, stpnm:event.item.stpnm, rt:event.item.rt,dir:event.item.dir };
			this.controller.stageController.pushScene({name:'predictions',templateModel:prediction},prediction);
		}
	},


	loadFavs : function(tsc,result){
		var len = result.rows.length;
		var row;
		
		if( len == 0){
			this.showNullPlaceholder();
			return;
		}
		
		for(var i=0; i<len; i++){
			row = result.rows.item(i);
			this.favs[i] = {
				stpid : row.stpid,
				stpnm : row.stpnm,
				name : decodeURIComponent(row.name), 
				rt : row.rt,
				dir : row.dir,
				dirInitial: row.dir[0]
			};
		}
		
		this.controller.modelChanged(this.favListModel);
	},

	loadFavsFail : function(tsc,error){
		if(error.code == 1){
	  		BT.setupDatabase();
	  		this.showNullPlaceholder();
	 	}
	},
	
	showNullPlaceholder : function(){
		if(this.favListWidget.mojo.getLength() == 0)
			this.controller.get('null-favs').style.display = 'block';			
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