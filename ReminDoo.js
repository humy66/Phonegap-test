Ext.ns("ReminDoo");


Ext.define('ReminDoo.Component', {
    requires : ["Ext.Component"],
    override: 'Ext.Component',
    show: function (animation) {
        return this.callParent([false]);
    },
    hide: function (animation) {
        return this.callParent([false]);
    }
});


ReminDoo.justBooted = true;
ReminDoo.tzOffset = 8;
ReminDoo.refreshSec = 60;
ReminDoo.Counter = ReminDoo.refreshSec  + 1;
ReminDoo.player = null;
ReminDoo.viewMode = 0;
ReminDoo.SyncRequest = false;
ReminDoo.LastUpdate = null;
ReminDoo.Session = {};


ReminDoo.util = {};
ReminDoo.timeOffset = 2 * 60 * 60 ;
ReminDoo.util.removeTime = function(d) {
	return Ext.DateExtras.clearTime(d);		
};
ReminDoo.util.parseBool = function(v) {return (v=="True") || (v=="true") || (v=="1") || (v==true);};
ReminDoo.util.parseDate = function(v) {
    if ((typeof v)=="string") {return new Date((Number(v)-ReminDoo.timeOffset)*1000);}
    return v;
};
ReminDoo.util.offsetDates = function (o) {
	for (var p in o) {
      if (Ext.isDate(o[p])) {
      	o[p] = Ext.DateExtras.add(o[p],Ext.Date.SECOND,ReminDoo.timeOffset);
      }
	}
}



ReminDoo.mask = function () {Ext.Viewport.setMasked({xtype:'loadmask',message:""});};
ReminDoo.unMask = function () {Ext.Viewport.setMasked(false);};

String.prototype.splice =
    function( idx, rem, s ) {return (this.slice(0,idx) + s + this.slice(idx +Math.abs(rem)));};

ReminDoo.request = function (query,method,params,onSuccess,onFailure, onResume) {
   //Ext.apply(params,{query:query});
   var urlEncodedParams = Ext.urlEncode(params);
   Ext.Ajax.request({
        method : method,
        url : ReminDoo.url+"?query="+query,
        params : urlEncodedParams,
        //headers : {},
        //jsonData:jsonData,
        success : function (response,opts) {
            try
            {
                var o = Ext.JSON.decode(response.responseText);
                if (onSuccess) {onSuccess(o,opts);}
            }
            catch (e)
            {
                console.debug("exception:",e);
                if (onFailure) {onFailure(response,opts);}
            }
        },
        failure : function (response,opts) {
        	console.debug("failure");
        	if (onFailure) {
				 if (onFailure) {onFailure(response,opts);}
        	} else {
        		console.log("******** Failed "+JSON.stringify(response));
	            var header = "Server Eror";
	            var msg  = JSON.stringify(response); //"Contact Support";
	            Ext.defer(function () {
	                Ext.Msg.alert(header,msg,function () {
	                    Ext.Msg.hide();
	                    if (onResume) {onResume();}
	                });
	            },100);
        	}
       }

    });
};

ReminDoo.get = function(query,params,onSuccess,onFailure,onResume) {
    ReminDoo.request(query,"GET",params,onSuccess,onFailure);
};
ReminDoo.post = function(query,params,onSuccess,onFailure,onResume) {
    ReminDoo.request(query,"POST",params,
    	function(response,opts) {
    		onSuccess(response,opts);
    		ReminDoo.PublishContacts(Ext.apply(params,{query:query}));
    	}
    	,onFailure);
    
};


ReminDoo.makeVoiceMessageURL = function (IdRec) {
   return ReminDoo.url + "?query=GetVoiceMail&IdRec="+IdRec;
}




ReminDoo.updateView = function(clock) {
	var btnToday =  clock.down("#today");
	var btnPlus  = 	clock.down('#button-plus');
	var btnMinus = 	clock.down('#button-minus');
	var now  = new Date();
	var s = ReminDoo.getWeekDay(now) + " " + Ext.Date.format(now,"d/m H:i");
	if (!ReminDoo.isCurrentDate()) {
		btnToday.show();
		s = "*** " + ReminDoo.getWeekDay(ReminDoo.theDate) + " " + Ext.Date.format(ReminDoo.theDate,"d/m") + " ***";
	} else {
		btnToday.hide();
	}
	clock.setTitle(s);
	var sDatePlus=Ext.Date.format(Ext.Date.add(ReminDoo.theDate,Ext.Date.DAY,1),"d/m");
	var sDateMinus=Ext.Date.format(Ext.Date.add(ReminDoo.theDate,Ext.Date.DAY,-1),"d/m");
	btnPlus.setText(sDatePlus);
	btnMinus.setText(sDateMinus);
};



ReminDoo.filterDate = function (viewMode) {
	ReminDoo.viewMode+=viewMode;
	if (ReminDoo.viewMode>1){ReminDoo.viewMode=1;}
	if (ReminDoo.viewMode<-1){ReminDoo.viewMode=-1;}

	
	var tb = Ext.getCmp("clock");

	var dt  = Ext.Date.clearTime(new Date());
	dt = Ext.Date.add(dt,Ext.Date.DAY,ReminDoo.viewMode);
	var sDate=Ext.Date.format(dt,"d/m/y");

	if (ReminDoo.viewMode!==0) { 
		tb.setTitle("*** "+sDate+" ***"); 
	}

	var dailyCount = 0;
	Ext.getStore("Daily").clearFilter();
	Ext.getStore("Daily").filter(function(item) {
		var result = Ext.Date.format(item.get("start"),"d/m/y")==sDate;
		if (result) dailyCount++;
		return result;
	});
	
	Ext.getStore("Event").clearFilter();
    Ext.getStore("Event").filter(function(item) {
		var start = item.get("start");
		return Ext.Date.format(start,"d/m/y")==sDate;
	});

	var c = Ext.getCmp("dailylist");
	if (dailyCount===0){c.hide();} else
	{
		c.show();
		c.setHeight(c.getItemHeight()*dailyCount);
	}
	
	ReminDoo.updateView();
	
};

ReminDoo.showMessageCount = function () {
	var store  = Ext.getStore("Messages");
	var nCount = 0;
	store.each(function(record) {
		      var isReceive = record.get("isReceive");
		      var NeedConfirmation = record.get("NeedConfirmation");
		      var wasConfirm = record.get("wasConfirm");
		      if ((!isReceive) || (NeedConfirmation && !wasConfirm)) {
		      		nCount++;
		      }
	});
	ReminDoo.getController("Message").setMessageCount(nCount);
};

ReminDoo.isOffline = false;
ReminDoo.lostConnection = function (res) {
	ReminDoo.getController("Main").lostConnection();
	ReminDoo.isOffline = true;
};

ReminDoo.resumeConnection = function (res) {
	ReminDoo.getController("Main").resumeConnection();
	ReminDoo.isOffline = false;
};

/*
ReminDoo.loadMessages = function (isFirst) {
	var store  = Ext.getStore("Messages");
	
	var maxId = -1;
	store.each(function(record) {
		maxId = Math.max(maxId,record.get("IdRec"));
	});
	var params = Ext.apply({},ReminDoo.Session);
	Ext.apply(params,{IdRec:maxId});

	ReminDoo.get("InMessages",params,
		function(o){
			if (o.success) {
				if (o.Table.length>0) {
					store.insert(0,o.Table);
					if (!isFirst) {
						ReminDoo.Play(ReminDoo.NEW_MESSAGE);
					}	
				}
				ReminDoo.showMessageCount();
			}
		},
	    ReminDoo.lostConnection
	    );
};
ReminDoo.maxIdRec = -1;
*/




ReminDoo.util.timeToMinutes = function(t) {
	return Ext.Date.diff(
		Ext.Date.clearTime(t,true),
		t,
		Ext.Date.MINUTE
		);
};

ReminDoo.util.diffMinutes = function(min,max) {
	return this.timeToMinutes(max) -  this.timeToMinutes(min);
};


ReminDoo.isCurrentDate = function () {
	var result = Ext.Date.format(ReminDoo.currentDate,"d/m/y") == Ext.Date.format(ReminDoo.theDate,"d/m/y");
	return result;
};

ReminDoo.isSameDate = function (d1,d2) {
	var result = Ext.Date.format(d1,"d/m/y") == Ext.Date.format(d2,"d/m/y");
	return result;
};


/*

ReminDoo.loadEvents = function (isFirst,isTimeout) {

	var dStore  = Ext.getStore("Daily");
	var hStore  = Ext.getStore("Hourly");
	
    //dStore.suspendEvents();
	//hStore.suspendEvents();

    // mark fro deletion
    dStore.each(function(record){record.set("mark",true);});
    hStore.each(function(record){record.set("mark",true);});
	
	ReminDoo.maxIdRec = -1;
	var params = Ext.apply(
		{
			IdRec : ReminDoo.maxIdRec,
			Date  : ReminDoo.theDate
		},
		ReminDoo.Session);
	



	ReminDoo.get("GetPersonEvents",
		params,
		function(o) {
			if (o.success) {
				//dStore.suspendEvents();
				//hStore.suspendEvents();

                if (ReminDoo.isOffline) {
                	ReminDoo.resumeConnection();	
                }


				Ext.getCmp('last-update').removeCls("error");
				ReminDoo.LastUpdate = new Date();
				Ext.getCmp('last-update').setHtml(Ext.Date.format(ReminDoo.LastUpdate,"H:i"));

				var hasNew = false;

				o.Table.forEach(function(d) {
					var IdRec = Number(d.IdRec);
					var isHidden = d.Hidden;
					ReminDoo.maxIdRec = Math.max(ReminDoo.maxIdRec,IdRec);
					if (ReminDoo.util.parseBool(d.isDay)) {
						var rec = dStore.getById(d.IdRec);
						if (rec) {
							rec.set("mark",false);
						} else {
							dStore.add(d);	
							hasNew = true;
						}
					} else {
						var record = hStore.getById(d.IdRec);
						if (record) {
							record.set("mark",false);
							record.set("isDay",d.isDay);
							record.set("StartTime",d.StartTime);
							record.set("EndTime",d.EndTime);
							record.set("Name",d.Name);
							record.set("Confirmation",d.Confirmation);
							record.set("Hidden",isHidden);
						} else {
							record = hStore.add(d)[0];
							hasNew = hasNew || !isHidden;
						}
						
					}
				});
				
				if (hasNew && isTimeout) {
					ReminDoo.Play(ReminDoo.NEW_EVENT);
				}
                
                var a = [];
			    dStore.each(
			    	function(record) {
			    		if (record.get("mark")) {
			    			a.push(record);
			    		}
			    	});
			    dStore.remove(a);

				var theTime = new Date();
			    a = [];
			    hStore.clearFilter();



			    hStore.each(
			    	function(record) {
			    		if (record.get("mark")) {
			    			a.push(record);
			    		} else {

							if (ReminDoo.isCurrentDate()) {
								var mi = ReminDoo.util.diffMinutes(theTime,record.get("StartTime"));
								var isConfirmation = record.get("Confirmation");
								var isHidden = record.get("Hidden");
								if ((mi===0) && (isConfirmation)) {
									
									ReminDoo.Confirm(
										  record.get("Name"),
							              function () { 
							              	var IdRec = record.get("IdRec");
							              	ReminDoo.post("ConfirmEvent",{IdRec:IdRec},
							              		function(res){
							              			ReminDoo.StopPlay();
							              			record.set("state","elapsed-event");
								              	});
							              },
							              Ext.emptyFn
							              ,
							              10
									);
								} else if (!isHidden && ((mi===60) || (mi===30) || (mi===10) || (mi===0))) {
									console.debug("reminder",mi,record);
									record.set("state","active-event");
									record.set("countDownMinutes",mi);
									ReminDoo.Play(ReminDoo.EVENT);
								} else {
									record.set("state","");
									if (isHidden) {
										record.set("state","hidden-event");
									} else if (mi<0) {
										mi = ReminDoo.util.diffMinutes(theTime,record.get("EndTime"));
										if (mi<0) {
											record.set("state","elapsed-event");
										}
									} else {
										if ((mi>0) && (mi<60)) {
											record.set("countDownMinutes",mi);
										} else {
											record.set("countDownMinutes",0);
										}
									}
								}
							}
			    		}
			    	});
			    hStore.remove(a);
				console.debug("b4 filter");
				hStore.filterBy(
					function(r){return !r.get("Hidden");}
				);
				

				var dList = Ext.getCmp("dailylist");
				dList.setHeight(dStore.getCount()*dList.getItemHeight());

			}
		},
		ReminDoo.lostConnection
	);
};
*/


ReminDoo.T = function (k) {
  return ReminDoo.D.containsKey(k)?ReminDoo.D.get(k):k;
}

ReminDoo.getWeekDay = function(d) {
	var s = "";
	switch(d.getDay()) {
		case 0 : s = "Sun";
				 break;
		case 1 : s = "Mon";
					 break;
		case 2 : s = "Tue";
					 break;
		case 3 : s = "Wed";
					 break;
		case 4 : s = "Thu";
					 break;
		case 5 : s = "Fri";
					 break;
		case 6 : s = "Sat";
					 break;
	}
	return ReminDoo.T(s);
	
};




ReminDoo.NEW_MESSAGE = 1;
ReminDoo.EVENT = 2;
ReminDoo.SIEREN = 3;
ReminDoo.NEW_EVENT = 4;
ReminDoo.CONFIRM = 5;


ReminDoo.StopPlay = function () {
	if (ReminDoo.player.isPlaying()) {
		ReminDoo.player.stop();
	}
};

ReminDoo.Play = function (what) {
	ReminDoo.StopPlay();
	var url = "audio/Very_Nice_Alarm.mp3";
	if (what==ReminDoo.NEW_MESSAGE) {
		url = "audio/amnesia.mp3";
	}
	if (what==ReminDoo.NEW_EVENT) {
		url = "audio/new_event.mp3";
		Ext.defer(
			function(){ReminDoo.StopPlay();},
			10000);
	}
	if (what==ReminDoo.SIEREN) {
		url = "audio/kill_bill_siren.mp3";
	}
	if (what==ReminDoo.CONFIRM) {
		url = "audio/dance-coco_jambo_2010.mp3";
	}
	ReminDoo.player.setUrl(url);
	ReminDoo.player.play();
};


ReminDoo.isEmergency = false;


ReminDoo.busyFlag = false;
ReminDoo.isConfirmationActive = false;


ReminDoo.isBusy = function () { 
	return ReminDoo.busyFlag || ReminDoo.isConfirmationActive;
};




ReminDoo.setBusy = function(callback,failure,retries) {
	if (callback) {
		if (ReminDoo.setBusy()) {callback(); return true;} 
		if (retries>0) {
			Ext.defer(function () { 
				ReminDoo.setBusy(callback,failure,retries-1);
			},10*1000);
		} else {
			if (failure) {failure();}
			return false;
		}
	} else {
		if (ReminDoo.isBusy()) return false;
		ReminDoo.busyFlag = true;
		return true;
	}

};

ReminDoo.clearBusy = function(){ReminDoo.busyFlag=false;};


// Loops

ReminDoo.onTimeout = function (isFirst,isTimeout) {
	if (!ReminDoo.setBusy()) {return;}
	ReminDoo.setBusy();
	ReminDoo.unMask();
    ReminDoo.loadMessages(isFirst);
    ReminDoo.loadEvents(isFirst,isTimeout);
    var tb = Ext.getCmp("clock");
	if (!Ext.isEmpty(tb)) {
		ReminDoo.updateView(tb);
	}
	
    // Handle day roll over
	if (!isFirst) {
		var t = Ext.Date.clearTime(new Date());
		if (Ext.Date.getDayOfYear(t)!=Ext.Date.getDayOfYear(ReminDoo.currentDate)) {
			ReminDoo.currentDate = t;
			ReminDoo.getController("Main").restoreCurrentDate();
		}
	}
	ReminDoo.clearBusy();
};
 
ReminDoo.Confirm = function(message,callback,failure) {
    function onSuccess() {
		callback();
		ReminDoo.clearBusy();
    }
	function onSetBusy() {
		ReminDoo.Play(ReminDoo.CONFIRM);
   		ReminDoo.getController("Main").Confirm(message,onSuccess);
	}
	ReminDoo.setBusy(onSetBusy,failure,10);
};



ReminDoo.onEmergency = function () {
	if (!ReminDoo.setBusy()) {return;}
	ReminDoo.get("EmergencyMessage",
		{},
		function(res) {
			if (res.success) {
				if (!Ext.isEmpty(res.Msg)) 
				{
					ReminDoo.getController("Main").EmergencyOn(res.Msg);
					ReminDoo.Play(ReminDoo.SIEREN);
					ReminDoo.isEmergency = true;
				} else {
					if (ReminDoo.isEmergency) {
						ReminDoo.isEmergency = false;	
						ReminDoo.getController("Main").EmergencyOff();
						if (ReminDoo.player.isPlaying()) {ReminDoo.player.stop();}
					}
					
				}
			} 
			ReminDoo.clearBusy();
		},
		function () {
			ReminDoo.clearBusy();
		}
	);
};



ReminDoo.gotoHomeTask = Ext.create(
		'Ext.util.DelayedTask', 
		function() {
	 	 	ReminDoo.getController("Main").gotoHome();
		}
);


ReminDoo.startPolling = function () {

	Ext.getBody().on({
	    swipe : function() {
	        ReminDoo.gotoHomeTask.delay(60*1000);
	    },
	    tap:function() {
	        ReminDoo.gotoHomeTask.delay(60*1000);
	    }
	});

   ReminDoo.currentDate = Ext.Date.clearTime(new Date());
   ReminDoo.theDate = ReminDoo.currentDate;
   ReminDoo.onTimeout(true);
   setInterval(function () { ReminDoo.onTimeout(false,true);},60*1000);
   setInterval(function () { ReminDoo.onEmergency();},15*1000);
};


ReminDoo.parseDate = function (s) {
   return  Ext.Date.parse(s,"c");
};

ReminDoo.NotImplemented = function () {
	Ext.Msg.alert("","תכונה זו  תמומש בגרסה עתידית");



};


ReminDoo.restoreCurrentDate = Ext.create('Ext.util.DelayedTask', function() {
	ReminDoo.getController("Main").restoreCurrentDate();
});


ReminDoo.Publish = function(o) {
	if (Ext.isEmpty(ReminDoo.PUBNUB)) return;
	var channel = 'ReminDoo_'+ReminDoo.SystemId;
	ReminDoo.PUBNUB.publish({
	    channel: channel,
	    message: o
	 });
};

ReminDoo.PublishContacts = function(o) {
	if (Ext.isEmpty(ReminDoo.PUBNUB)) return;
	var channel = 'ReminDoo_'+ReminDoo.SystemId+"_"+ReminDoo.PersonId;
	//console.debug("publish contacts",channel,o);
	Ext.defer(function() {
		 ReminDoo.PUBNUB.publish({
		    channel: channel,
		    message: o
		 });
	},
	2000);
};


ReminDoo.PatientPingTask = Ext.create(
		'Ext.util.DelayedTask', 
		function() {
			Ext.Msg.alert("",ReminDoo.T("PatientPingFailed"));
		}
);

ReminDoo.initPubNub = function ()  {
		ReminDoo.PatientPingTask.delay(1000*60*5);

	    if (Ext.isEmpty(ReminDoo.PUBNUB)) {
		    ReminDoo.PUBNUB = PUBNUB.init({
			   	publish_key: 'pub-c-9c74ce61-5f29-415a-8a55-aacd69971283',
		    	subscribe_key: 'sub-c-56d8c102-846c-11e3-9cb4-02ee2ddab7fe'
			});
	    }
	    var channel = 'ReminDoo_'+ReminDoo.SystemId+"_"+ReminDoo.PersonId;
	    
	    ReminDoo.Channel = channel;
	    //console.debug("subscribe to channel",channel);
		ReminDoo.PUBNUB.subscribe({
	  		channel: channel,
	  		message: function(m){
	  			console.debug("message:"+m.query);
				Ext.defer(
					function() {
						if (m.query=="PationePing") {
							ReminDoo.PatientPingTask.delay(1000*60*5);
						}
						if (m.query=="SetNotification") {
			  				if ((m.value=="1") && (m.id=="hc")) {
			  					Ext.Msg.alert(ReminDoo.T("NewCall"),ReminDoo.T("Doctor"));	
			  				}
							if ((m.value=="0") && (m.id=="hc")) {
			  					Ext.Msg.alert("",ReminDoo.T("DoctorCallClose"));	
			  				}
			  				ReminDoo.getController("Notification").loadNotifications();
			  			}
						if (m.query=="SetNotificationStatus") {
							if ((m.value=="1") && (m.id=="hc")) {
			  					Ext.Msg.alert("",ReminDoo.T("DoctorCallInProcess"));	
			  				}
							
			  				ReminDoo.getController("Notification").loadNotifications();
			  			}

						if (m.query=="ConfirmEvent") {
							var dt = ReminDoo.util.removeTime(new Date());
							ReminDoo.getController("Event").loadEvents(dt);

						}


			  			if ((m.query=="MessageReceive") || (m.query=="MessageReply")) {
							ReminDoo.getController("VoiceMail").loadMessages();
							ReminDoo.getController("Mail").loadOutMessages();

			  			}
		  		},100);
	  		}
		});
};



ReminDoo.getSimPicture = function () { 
	return "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";
}


ReminDoo.alert = function(header,msg,callback)
{
	Ext.Msg.alert(ReminDoo.T(header),ReminDoo.T(msg),callback);
}