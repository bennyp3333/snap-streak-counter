//@ui {"widget":"label", "label":"Digit Models (0-9)"}
//@input SceneObject[] digits
//@ui {"widget":"separator"}
//@input string spawnGroup
//@input SceneObject spawnParent
//@input SceneObject logo
//@ui {"widget":"separator"}
//@input float padding = 0.5
//@input float logoPadding = 1.0
//@ui {"widget":"separator"}
//@input float maxWidth = 10.0
//@input float maxScale = 1.0
//@input float zScalePercent = 1.0
//@ui {"widget":"separator"}
//@input float digitPositionY = 0
//@input float logoPositionY = 0
//@ui {"widget":"separator"}
//@input Asset.Material[] logoMaterials
//@input SceneObject logoSparkles
//@ui {"widget":"separator"}
//@input bool debug
//@input string debugName = "" {"showIf":"debug"}
//@input Component.Text debugText {"showIf":"debug"}

var activeDigits = [];
var currentNumber = -1;

function setNumber(num) {
    if (num === currentNumber) {
        debugPrint("Number unchanged: " + num);
        return;
    }
    
    debugPrint("Setting number: " + num);
    currentNumber = num;
    
    // Clear existing digits
    clearDigits();
    
    // Get individual digits
    var digits = getDigitsArray(num);
    
    // Spawn new digit models
    spawnDigits(digits);
    
    // Arrange digits and logo
    arrangeDisplay();

    setLogoMaterial(num);
}

function setLogoMaterial(num){
    var logoMesh = script.logo.getComponent("Component.RenderMeshVisual");
    if(num < 100){
        //keep current materials
    }else if(num < 200){
        logoMesh.clearMaterials();
        logoMesh.addMaterial(script.logoMaterials[0]);
    }else if(num < 300){
        logoMesh.clearMaterials();
        logoMesh.addMaterial(script.logoMaterials[1]);
        script.logoSparkles.enabled = true;
    }else{
        logoMesh.clearMaterials();
        logoMesh.addMaterial(script.logoMaterials[2]);
        script.logoSparkles.enabled = true;
    }
}

function getDigitsArray(num) {
    if (num === 0) return [0];
    
    var digits = [];
    while (num > 0) {
        digits.unshift(num % 10);
        num = Math.floor(num / 10);
    }
    return digits;
}

function clearDigits() {
    global.spawn.destroyGroup(script.spawnGroup);
    activeDigits = [];
}

function spawnDigits(digits) {
    for (var i = 0; i < digits.length; i++) {
        var digitValue = digits[i];
        var template = script.digits[digitValue];
        
        var spawned = global.spawn.create(template, script.spawnParent, script.spawnGroup);
        
        if (spawned && spawned.obj) {
            activeDigits.push({
                obj: spawned.obj,
                value: digitValue,
                spawnData: spawned
            });
            debugPrint("Spawned digit: " + digitValue);
        } else {
            debugPrint("ERROR: Failed to spawn digit " + digitValue, true);
        }
    }
}

function getBounds(sceneObj) {
    var meshVisComp = sceneObj.getComponent("Component.RenderMeshVisual");
    var min = meshVisComp.mesh.aabbMin;
    var max = meshVisComp.mesh.aabbMax;
    
    return {
        min: min,
        max: max,
        width: max.x - min.x,
        height: max.y - min.y,
        depth: max.z - min.z
    };
}

function arrangeDisplay() {
    // Calculate total width of digits at scale 1
    var digitBounds = [];
    var totalDigitsWidth = 0;
    var maxHeight = 0;
    
    for (var i = 0; i < activeDigits.length; i++) {
        var bounds = getBounds(activeDigits[i].obj);
        digitBounds.push(bounds);
        totalDigitsWidth += bounds.width;
        
        // Track tallest digit for vertical centering
        if (bounds.height > maxHeight) {
            maxHeight = bounds.height;
        }
        
        if (i < activeDigits.length - 1) {
            totalDigitsWidth += script.padding;
        }
    }
    
    // Calculate scale factor
    var scale = script.maxScale;
    if (totalDigitsWidth * scale > script.maxWidth) {
        scale = script.maxWidth / totalDigitsWidth;
    }
    
    var scaledPadding = script.padding * scale;
    var scaledTotalWidth = 0;
    
    // Calculate scaled total width
    for (var k = 0; k < digitBounds.length; k++) {
        scaledTotalWidth += digitBounds[k].width * scale;
        if (k < digitBounds.length - 1) {
            scaledTotalWidth += scaledPadding;
        }
    }
    
    // Calculate vertical offset to center digits (baseline offset)
    // Origins are at bottom, so shift down by half the scaled max height
    var baselineY = script.digitPositionY - (maxHeight * scale / 2);
    
    // Position digits centered around origin
    var startX = -scaledTotalWidth / 2;
    var currentX = startX;

    for (var j = 0; j < activeDigits.length; j++) {
        var digit = activeDigits[j];
        var bounds = digitBounds[j];
        var transform = digit.obj.getTransform();
        
        // Apply scale (z axis scaled separately)
        var zScale = scale * script.zScalePercent;
        transform.setLocalScale(new vec3(scale, scale, zScale));
        
        var scaledWidth = bounds.width * scale;
        var digitCenterOffsetX = (bounds.min.x + bounds.max.x) / 2 * scale;
        var posX = currentX + (scaledWidth / 2) - digitCenterOffsetX;
        
        transform.setLocalPosition(new vec3(posX, baselineY, 0));
        
        currentX += scaledWidth + scaledPadding;
    }
    
    // Position logo to the right of the digits (no scaling)
    script.logo.enabled = true;
            
    var logoBounds = getBounds(script.logo);
    var logoScale = script.logo.getTransform().getLocalScale();
    var logoTransform = script.logo.getTransform();
    
    var scaledLogoWidth = logoBounds.width * logoScale.x;
    var logoCenterOffsetX = (logoBounds.min.x + logoBounds.max.x) / 2 * logoScale.x;
    // currentX already includes trailing padding, so just use scaledTotalWidth/2 for right edge
    var digitsRightEdge = scaledTotalWidth / 2;
    var logoX = digitsRightEdge + script.logoPadding + (scaledLogoWidth / 2) + logoCenterOffsetX;
    
    logoTransform.setLocalPosition(new vec3(logoX, script.logoPositionY, 0));
    
    debugPrint("Arranged " + activeDigits.length + " digits, scale: " + scale.toFixed(2) + ", width: " + scaledTotalWidth.toFixed(2));
}

// Debug
function debugPrint(text, force) {
    if (!force && !script.debug) return;
    var newLog = (script.debugName || script.getSceneObject().name) + ": " + text;
    if (global.textLogger) global.logToScreen(newLog);
    if (script.debugText) script.debugText.text = newLog;
    print(newLog);
}

// Expose API
script.setNumber = setNumber;
setNumber(0);