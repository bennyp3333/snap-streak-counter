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
//@input bool debug
//@input string debugName = "Menu" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

var self = script.getSceneObject();
var selfTransform = self.getTransform();
var selfScreenTransform = self.getComponent("Component.ScreenTransform");

var isOpen = false;
var isAnimating = false;

function init(){
    //set aspect ratio
    setAspect(selfScreenTransform, 1.0);
    
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
    });
    
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