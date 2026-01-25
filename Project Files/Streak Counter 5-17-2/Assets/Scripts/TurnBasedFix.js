// @input Component.ScriptComponent turnBased {"label": "Turn Based Component"}
//@input bool enableForceCapture

script.turnBased.endTurn = async function(){
    if (this.requireTurnSubmission) {
        if(script.enableForceCapture){
            this.turnDataController.setCaptureSnap(!!this.autoCaptureHelper);
        }
        this.turnDataController.endTurn();
        const isFinalTurn = await this.turnDataController.isFinalTurn();
        if (isFinalTurn) {
            this.sceneObjectsController.onGameOver();
            this.onGameOver.trigger();
        } else {
            this.onTurnEnd.trigger();
        }
    }
}

script.forceCapture = function(){
    if(script.enableForceCapture){
        global.events.trigger("forceCapture");
    }
}

/*
function onTapped(eventData)
{
    script.turnBased.endTurn();
}
var event = script.createEvent("TapEvent");
event.bind(onTapped);

// Automatically end turn when user captures a snap
script.createEvent('SnapRecordStopEvent').bind(function() {
    print('SnapRecordStopEvent - ending turn');
    script.turnBased.setCurrentTurnVariable('sendTimestamp', Date.now());
    script.turnBased.endTurn();
});

script.createEvent('SnapImageCaptureEvent').bind(function() {
    print('SnapImageCaptureEvent - ending turn');
    script.turnBased.setCurrentTurnVariable('sendTimestamp',Date.now());
    script.turnBased.endTurn();
});
*/