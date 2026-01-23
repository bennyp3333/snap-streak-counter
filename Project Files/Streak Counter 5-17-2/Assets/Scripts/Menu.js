//@input Component.ScriptComponent streakController
//@input Component.Camera camera
//@ui {"widget":"separator"}
//@input Component.Text currentStreakNum
//@input Component.Text longestStreakNum
//@input Component.Text totalSnapsNum
//@input Component.ScriptComponent totalSnapsBitmoji
//@input Component.Text fastestResponseNum
//@input Component.Text fastestResponseUnits
//@input Component.ScriptComponent fastestResponseBitmoji
//@input Component.Text avgResponseUser1Num
//@input Component.Text avgResponseUser1Units
//@input Component.Text avgResponseUser2Num
//@input Component.Text avgResponseUser2Units
//@ui {"widget":"separator"}
//@input SceneObject[] section2Bitmoji
//@input SceneObject[] section3Bitmoji
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "Menu" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

var self = script.getSceneObject();
var selfTransform = self.getTransform();
var selfScreenTransform = self.getComponent("Component.ScreenTransform");

var isOpen = false;
var isAnimating = false;

var section2BitmojiScript = null;
var section3BitmojiScript = null;

function init(){
    //set aspect ratio
    setAspect(selfScreenTransform, 1.0);

    //set bitmoji stickers
    var randomSection2Bitmoji = Math.floor(Math.random() * script.section2Bitmoji.length);
    section2BitmojiScript = script.section2Bitmoji[randomSection2Bitmoji].getComponent("Component.ScriptComponent");
    for(var i = 0; i < script.section2Bitmoji.length; i++){
        script.section2Bitmoji[i].enabled = (i == randomSection2Bitmoji);
    }

    var randomSection3Bitmoji = Math.floor(Math.random() * script.section3Bitmoji.length);
    section3BitmojiScript = script.section3Bitmoji[randomSection3Bitmoji].getComponent("Component.ScriptComponent");
    for(var i = 0; i < script.section3Bitmoji.length; i++){
        script.section3Bitmoji[i].enabled = (i == randomSection3Bitmoji);
    }
    
    debugPrint("Initilized!");
}

function toggle(){
    if(isAnimating) return;
    isAnimating = true;
    
    if(isOpen){
        global.faderManager.hide(self, function(){
            isAnimating = false;
        });
        global.faderManager.hide("Arrow In");
        global.faderManager.show("Arrow Out");
    }else{
        loadStats();
        global.faderManager.show(self, function(){
            isAnimating = false;
        });
        global.faderManager.show("Arrow In");
        global.faderManager.hide("Arrow Out");
    }
    isOpen = !isOpen;
}

function setAspect(screenTransform, aspect){
    var cameraAspect = script.camera.aspect;
    var width = screenTransform.anchors.getSize().x;
    var height = width * aspect * cameraAspect;
    screenTransform.anchors.setSize(new vec2(width, height));
}

function loadStats(){
    if(!script.streakController.isReady()) return;
    script.streakController.getFullStats().then(stats => {
        script.currentStreakNum.text = stats.currentStreak.toString();
        script.longestStreakNum.text = stats.longestStreak.toString();
        script.totalSnapsNum.text = stats.totalSnaps.toString();

        if(stats.averageResponseTimes.user1){
            var formatUser1AvgRespTime = formatTime(stats.averageResponseTimes.user1.timeMs);
            script.avgResponseUser1Num.text = formatUser1AvgRespTime.number.toString();
            script.avgResponseUser1Units.text = formatUser1AvgRespTime.units;
        }
        
        if(stats.averageResponseTimes.user2){
            var formatUser2AvgRespTime = formatTime(stats.averageResponseTimes.user2.timeMs);
            script.avgResponseUser2Num.text = formatUser2AvgRespTime.number.toString();
            script.avgResponseUser2Units.text = formatUser2AvgRespTime.units;
        }

        if(stats.fastestResponse.timeMs){
            var formatFastestRespTime = formatTime(stats.fastestResponse.timeMs);
            script.fastestResponseNum.text = formatFastestRespTime.number.toString();
            script.fastestResponseUnits.text = formatFastestRespTime.units;
        }

        if(stats.totalSnaps > 0){
            section2BitmojiScript.loadUserByIndex(Math.round(Math.random()));
        }

        if(stats.fastestResponse.winnerId){
            section3BitmojiScript.loadUserByIndex(stats.fastestResponse.winnerId);
        }else if(stats.totalSnaps > 0){
            section3BitmojiScript.loadUserByIndex(Math.round(Math.random()));
        }
    });
    
}

function formatTime(ms) {
    if (ms === Infinity || ms === null || isNaN(ms)) return null;

    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);

    var number = 0;
    var units = '';

    if (hours > 0) {
        number = hours;
        units = 'hr';
    } else if (minutes > 0) {
        number = minutes;
        units = "min";
    } else if (seconds > 0) {
        number = seconds;
        units = "sec";
    } else {
        number = ms;
        units = "ms";
    }

    return {
        number: number,
        units: units
    }
}

script.toggle = toggle;

script.createEvent("OnStartEvent").bind(init);

// Debug
function debugPrint(text){
    if(script.debug){
        var newLog = script.debugName + ": " + text;
        if(global.textLogger){ global.logToScreen(newLog); }
        if(script.debugText){ script.debugText.text = newLog; }
        print(newLog);
    }
}

function errorPrint(text){
    var errorLog = "!!ERROR!! " + script.debugName + ": " + text;
    if(global.textLogger){ global.logError(errorLog); }
    if(script.debugText){ script.debugText.text = errorLog; }
    print(errorLog);
}