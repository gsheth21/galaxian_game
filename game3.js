/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
var INPUT_TRIANGLES_URL = "objects.json"; // triangles file loc
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5,1.5,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var textureBuffers = [];
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press
var texture;
var vNormAttribLoc;
var texCoordAttribLoc;
var samplerLoc;
var alphaUniformLocation;
var moveRight = true; // Initial direction
var moveUp = true;
var moveDown = true;
var moveSpeed = 0.025; // Speed of translation
var moveDownSpeed = -0.025;

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader

// Call updateTranslations before rendering
var translationIntervalId = null;  // Store interval ID
var translationAlienIntervalId = null;  // Store interval ID
var boundaryHit = true;
var boundaryHitAlienBullet = true;
var bulletFire = 0;

function startTranslationUpdates() {
    translationIntervalId = setInterval(() => {
        updateBulletTranslation();
    }, 50);
}

function startAlienTranslationUpdates() {
    translationAlienIntervalId = setInterval(() => {
        updateAlienBulletTranslation();
    }, 50);
}


/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file


function checkCollisionBulletWithAlien() {
    if (!bulletFire) return; // Only check collision if a bullet is fired

    let bullet = inputTriangles[1]; // Assuming inputTriangles[1] is the bullet
    let bulletPos = vec3.fromValues(bullet.center[0] + bullet.translation[0], bullet.center[1] + bullet.translation[1], 0); // Bullet position in 3D

    for (let i = 2; i < inputTriangles.length; i=i+4) {
            let alien = inputTriangles[i]; 
            

            let bullet1 = inputTriangles[i+1];// Iterate through all aliens
            let bullet2 = inputTriangles[i+2];
            let bullet3 = inputTriangles[i+3];

            if (alien.attack === false) {
                let alienPos = vec3.fromValues(
                    alien.center[0] + alien.translation[0],
                    alien.center[1] + alien.translation[1],
                    0
                );
    
                let distance = vec3.distance(bulletPos, alienPos);
                let collisionThreshold = 0.15;

                // Check for intersection (bounding box collision detection)
                if ( distance< collisionThreshold) {
                    alien.attack = true;
                    bullet1.visible = false;
                    bullet2.visible = false;
                    bullet3.visible = false;
                    console.log(`Hit alien ${i}!`);
                    alien.visible = false;
                    
                    resetBullet();
                    return;
                }
            }
    }
}

function checkCollisionAlienWithShip(i, ship) {
    let alien = inputTriangles[i];
    let bullet1 = inputTriangles[i+1];// Iterate through all aliens
    let bullet2 = inputTriangles[i+2];
    let bullet3 = inputTriangles[i+3];
    let shipBullet = inputTriangles[1];
    let alienPos = vec3.fromValues(alien.center[0] + alien.translation[0], alien.center[1] + alien.translation[1], 0); // Bullet position in 3D
        
    let shipPos = vec3.fromValues(
        ship.center[0] + ship.translation[0],
        ship.center[1] + ship.translation[1],
        0
    );

    let distance = vec3.distance(alienPos, shipPos);
    let collisionThreshold = 0.25;

    // Check for intersection (bounding box collision detection)
    if ( distance< collisionThreshold) {

        console.log(distance);
        alien.attack = true;
        bullet1.visible = false;
        bullet2.visible = false;
        bullet3.visible = false;
        console.log(`Hit Ship!`);
        alien.visible = false;
        ship.visible = false;
        shipBullet.visible = false;
        // resetBullet();
        return;
    }

}


let time = 0; // Time variable for oscillation
const frequency = 0.05; // Speed of oscillation
const amplitude = 0.5; // Maximum horizontal oscillation
const dropSpeed = -0.01; // Speed of dropping along the y-axis
let times = [];
let activeAlienIndex = 2; // Start with the first triangle in the range
let progress = {};
let start = 2;

// function updateSinusoidalTranslation( ) {

//     if(times.length == 0) {
//         for(let i=0; i<inputTriangles.length; i++) {
//             times.push(0);
//             inputTriangles[i].visible = true;
//         }
//     }
    
//     let i = start;
//     // Target a specific triangle set (e.g., the second triangle)
//     while(i<start+4) {
//         // console.log(i);
//         currSet = inputTriangles[i];
//         checkCollisionAlienWithShip(i,inputTriangles[0]);
//         if (!currSet.visible) {
//             i++;
//             continue;
//         }
//         // currSet.attack = true;
//         times[i] += frequency; // Increment time for oscillation
//         // Apply sinusoidal motion to the x-axis
//         currSet.translation[0] = amplitude * Math.sin(times[i]);

//         // Decrease the y-axis position to simulate dropping
//         currSet.translation[1] += dropSpeed;
//         // startAlienTranslationUpdates();

//         // for(var j=0;j<3;j++) {
//             // currSet.translation[1] 
//             updateAlienBulletTranslation(i+1, i);
//         // }

//         // Check if it reaches the bottom boundary and reset
//         if (currSet.translation[1] < -1.75) { // Assuming -1.5 is the "ground"
//             // currSet.translation[1] = 1.5; // Reset to the top
//             // currSet.translation[0] = 0; // Center the x-axis
//             // times[i] = 0; // Reset time for oscillation
//             currSet.visible = false; // Make the triangle disappear
//             inputTriangles[i+1].visible = false;
//             inputTriangles[i+2].visible = false;
//             inputTriangles[i+3].visible = false;
//             i = start + 4;
//             start = start + 4;
//             for (let j = start; j < start + 4 && j < inputTriangles.length; j++) {
//                 if (!times[j]) times[j] = 0; // Initialize `times` if not already set
//                 inputTriangles[j].visible = true; // Ensure the triangles are visible
//                 // inputTriangles[j].translation = [0, , 0]; // Reset position
//             }
//         } else {
//             i++;
//         }
//     }
//     renderModels();  // Re-render the scene with updated translations
//     requestAnimationFrame(updateSinusoidalTranslation); // Schedule the next frame

// }

// does stuff when keys are pressed

// function updateSinusoidalTranslation(alienIndex) {
//     return new Promise((resolve) => {
//         let allInvisible = true; // Track if all triangles in the group are invisible

//         const totalBoundary = 1.8; // Total boundary length
//         const quarterBoundary = totalBoundary / 4; // Length of each quarter

//         // Track progress for milestones
//         if (!progress[alienIndex]) {
//             progress[alienIndex] = [false, false, false]; // 1/4th, 2/4th, 3/4th milestones
//         }

//         for (let i = alienIndex; i < alienIndex + 4 && i < inputTriangles.length; i++) {
//             const currSet = inputTriangles[i]; // Access the specific triangle

//             if (!currSet) {
//                 console.error(`Triangle with index ${triangleIndex} does not exist.`);
//                 resolve(); // Resolve to avoid breaking the animation loop
//                 return;
//             }

//             // Initialize `times` and `visible` if not already done
//             if (times[i] === undefined) {
//                 times[i] = 0; // Initialize time for this triangle
//                 // currSet.visible = true; // Set the triangle as visible initially
//             }

//             // Skip updates for invisible triangles
//             if (!currSet.visible) continue;

//             allInvisible = false; // At least one triangle is still visible

//             times[i] += frequency; // Increment time for sinusoidal motion

//             // Apply sinusoidal motion to the x-axis
//             currSet.translation[0] = amplitude * Math.sin(times[i]);

//             // Decrease the y-axis position to simulate dropping
//             currSet.translation[1] += dropSpeed;

//             // Calculate the current progress along the boundary
//             const progressY = -currSet.translation[1]; // Distance covered from the top
//             const milestones = progress[alienIndex];

//             // Trigger translations for other triangles at each 1/4th milestone
//             if (progressY >= quarterBoundary && !milestones[0]) {
//                 updateAlienBulletTranslation(alienIndex + 1, alienIndex); // Trigger for triangle 2
//                 milestones[0] = true; // Mark milestone as reached
//             } else if (progressY >= 2 * quarterBoundary && !milestones[1]) {
//                 updateAlienBulletTranslation(alienIndex + 2, alienIndex); // Trigger for triangle 3
//                 milestones[1] = true;
//             } else if (progressY >= 3 * quarterBoundary && !milestones[2]) {
//                 updateAlienBulletTranslation(alienIndex + 3, alienIndex); // Trigger for triangle 4
//                 milestones[2] = true;
//             }

//             // Check if the triangle hits the bottom boundary
//             if (currSet.translation[1] < -1.75) { // Assuming -1.75 is the "ground"
//                 currSet.visible = false; // Make the triangle disappear
//             }
//         }
//         if (allInvisible) resolve();
//         renderModels();
//         requestAnimationFrame(() => updateSinusoidalTranslation(alienIndex).then(resolve));
//     });
// }

function updateSinusoidalTranslation(startIndex) {
    return new Promise((resolve) => {
        const totalBoundary = 2; // Total boundary length
        const quarterBoundary = totalBoundary / 4; // Distance to trigger next translations

        const t1 = inputTriangles[startIndex]; // Starting triangle
        const t2 = inputTriangles[startIndex + 1];
        const t3 = inputTriangles[startIndex + 2];
        const t4 = inputTriangles[startIndex + 3];

        // Initialize times for sinusoidal motion
        times[startIndex] = times[startIndex] || 0;
        times[startIndex + 1] = times[startIndex + 1] || 0;
        times[startIndex + 2] = times[startIndex + 2] || 0;
        times[startIndex + 3] = times[startIndex + 3] || 0;

        // Move the first triangle sinusoidally
        times[startIndex] += frequency;
        t1.translation[0] = amplitude * Math.sin(times[startIndex]);
        t1.translation[1] += dropSpeed;

        if(!t2.isAlienBulletTranslationEnabled) {
            times[startIndex + 1] += frequency;
            t2.translation[0] = amplitude * Math.sin(times[startIndex]);
            t2.translation[1] += dropSpeed;
        }
        
        if(!t3.isAlienBulletTranslationEnabled) {
            times[startIndex + 2] += frequency;
            t3.translation[0] = amplitude * Math.sin(times[startIndex]);
            t3.translation[1] += dropSpeed;
        }

        if(!t4.isAlienBulletTranslationEnabled) {
            times[startIndex + 3] += frequency;
            t4.translation[0] = amplitude * Math.sin(times[startIndex]);
            t4.translation[1] += dropSpeed;
        }

        if (-t2.translation[1] >= quarterBoundary) {
            updateAlienBulletTranslation(startIndex + 1, startIndex, t2.translation[0]); // Move second triangle
        }
        if (-t3.translation[1] >= 2 * quarterBoundary) {
            updateAlienBulletTranslation(startIndex + 2, startIndex, t3.translation[0]); // Move third triangle
        }
        if (-t4.translation[1] >= 3 * quarterBoundary) {
            updateAlienBulletTranslation(startIndex + 3, startIndex, t4.translation[0]); // Move fourth triangle
        }

        // Check if the first triangle hits the boundary
        if (t1.translation[1] < -1.75) {
            t1.visible = false;
            resolve(); // Resolve when the first triangle finishes
            return;
        }

        renderModels();
        // Schedule the next frame
        requestAnimationFrame(() => updateSinusoidalTranslation(startIndex).then(resolve));
    });
}


async function dropAliens() {
    var alienBullets = [];
    var aliens = [];
    for(var i=2, j=0; i<inputTriangles.length; i++, j++) {
        if(j%4 == 0) {
            aliens.push(i);
        } else {
            alienBullets.push(i);
        }
    }
    if(activeAlienIndex < inputTriangles.length) { // Update triangles 2 to 5 sequentially
        await updateSinusoidalTranslation(activeAlienIndex);
        activeAlienIndex += 4;
        dropAliens();
    }
}




function handleKeyDown(event) {
    handleKeyDown.modelOn = inputTriangles[0];
    handleKeyDown.anotherModelOn = inputTriangles[1];
    
    function translateModel(offset) {
        if (handleKeyDown.modelOn != null) {
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
            if(!bulletFire) {
                vec3.add(handleKeyDown.anotherModelOn.translation,handleKeyDown.anotherModelOn.translation,offset);
            }
            
        }
    } // end translate model
    
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(), viewUp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector
    viewUp = vec3.normalize(viewUp, vec3.cross(temp, viewRight, lookAt));

    switch (event.code) {
        
        // model selection
        case "ArrowRight": // select next triangle set
            translateModel(vec3.scale(temp,viewRight,viewDelta));
            break;
        case "ArrowLeft": // select previous triangle set
            translateModel(vec3.scale(temp,viewRight,-viewDelta));
            break;
        // case "Space": 
        //     // select previous triangle set
        //     // renderBullet(inputTriangles[0]);
        //     // translateBullet(vec3.scale(temp,viewUp,viewDelta));
        //     if(boundaryHit) {
        //     bulletFire = 1;
        //     startTranslationUpdates();
        //     setInterval(checkCollision,100);
        //     }
        //     break;
        case "Space": 
            // if(boundaryHit) {
            //     bulletFire = 1;
            //     resetBullet();

            //     startTranslationUpdates();
            // }
            
            if (!bulletFire) { // Only fire if the bullet isn't already fired

                bulletFire = 1;

                // Reset bullet position to the spaceship's position before firing

                inputTriangles[1].translation[1] = inputTriangles[0].translation[1];

                inputTriangles[1].translation[0] = inputTriangles[0].translation[0];



                // Start the bullet's movement upwards
                startTranslationUpdates();

            }
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye,defaultEye);
            Center = vec3.copy(Center,defaultCenter);
            Up = vec3.copy(Up,defaultUp);
            break;
    } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed


    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height; 
      imageContext = imageCanvas.getContext("2d"); 
      var bkgdImage = new Image(); 
      bkgdImage.crossOrigin = "Anonymous";
      bkgdImage.src = "galaxy.jpg";
      bkgdImage.onload = function(){
          var iw = bkgdImage.width, ih = bkgdImage.height;
          imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
     }

     
    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

function loadTexture(texturePath) {
    const texture = gl.createTexture();
    const image = new Image();
    
    image.crossOrigin = "Anonymous";  // Allows cross-origin image loading if needed
    image.onload = function() {
        const imgWidth = image.width;
        const imgHeight = image.height;

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  // Flip the image's Y axis

        // Upload the image into the texture
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // Generate mipmaps if dimensions are power of two
        if ((imgWidth & (imgWidth - 1)) === 0 && (imgHeight & (imgHeight - 1)) === 0) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            // Set parameters for non-power-of-two textures
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);  // Unbind texture when done
    };
    
    image.src = texturePath;  // Start loading the texture image

    return texture;
}

// read models in, load them into webgl buffers
function loadModels() {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles"); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var textureToAdd; // vtx texture to add to the coord array

            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
            var temp = vec3.create(); // an intermediate vec3
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 
                inputTriangles[whichSet].attack = false;
                inputTriangles[whichSet].visible = true;
                inputTriangles[whichSet].isAlienBulletTranslationEnabled = false;

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glTextures = []; // flat texture list for webgl

                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    textureToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get texture to add

                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glTextures.push(1-textureToAdd[0],textureToAdd[1]); // put texture coord list

                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in

                textureBuffers[whichSet] = gl.createBuffer(); // init empty webgl set texture component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glTextures),gl.STATIC_DRAW); // data in

                inputTriangles[whichSet].texture = loadTexture(inputTriangles[whichSet].material.texture);
            
                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
            viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        attribute vec2 aTextureCoords;
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader
        varying vec2 vTextureCoords;

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 

            vTextureCoords = aTextureCoords;
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        uniform sampler2D uSampler;
        uniform float uAlpha;

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
        varying vec2 vTextureCoords;
            
        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec4 texture = texture2D(uSampler, vTextureCoords);
            vec3 colorOut = (ambient + diffuse + specular) * texture.rgb;
            // gl_FragColor = vec4(colorOut, texture.a*uAlpha);
            gl_FragColor = vec4(colorOut, texture.a);
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array

                // Set up texture coordinate attribute and sampler
                texCoordAttribLoc = gl.getAttribLocation(shaderProgram, "aTextureCoords");
                gl.enableVertexAttribArray(texCoordAttribLoc);

                samplerLoc = gl.getUniformLocation(shaderProgram, "uSampler");
                alphaUniformLocation = gl.getUniformLocation(shaderProgram, "uAlpha");
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                
                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();


        // Update the center with the current translation
        // vec3.add(currModel.center, currModel.center, currModel.translation);
        
        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices


    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    // gl.depthMask(false);  // Disable depth writing
    gl.enable(gl.BLEND);  // Enable blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Alpha blending

    // render each triangle set
    var currSet; // the tri set and its material properties
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        if(currSet.visible == false) continue;

        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent

        gl.uniform1f(alphaUniformLocation,inputTriangles[whichTriSet].material.alpha);
        
        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed

        gl.bindBuffer(gl.ARRAY_BUFFER,textureBuffers[whichTriSet]);
        gl.vertexAttribPointer(texCoordAttribLoc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTriangles[whichTriSet].texture);
        gl.uniform1i(samplerLoc, 0);  // Bind the texture to texture unit 0

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set
    gl.depthMask(true);
} // end render model



function updateTranslations() {
    let boundaryHitAlien = false;

    // Loop through each triangle set and update translation
    for (var whichSet = 2; whichSet < inputTriangles.length; whichSet++) {
        var currSet = inputTriangles[whichSet];
        if(currSet.attack == false && currSet.isAlienBulletTranslationEnabled == false) {
            // Adjust translation based on direction
            if (moveRight) {
                currSet.translation[0] += moveSpeed; // Move right
            } else {
                currSet.translation[0] -= moveSpeed; // Move left
            }

            // Check if any triangle hits the boundary (assume [-1, 1] normalized device coords)
            var newPosX = currSet.center[0] + currSet.translation[0];
            if (newPosX >= 1.5 || newPosX <= -0.5) {
                boundaryHitAlien = true;
            }
        }
    }

    // Reverse direction if boundary is hit
    if (boundaryHitAlien) {
        moveRight = !moveRight;
    }
}



function updateBulletTranslation() {
    boundaryHit = false;
    
    // console.log("set interva inside")

    var currSet = inputTriangles[1];

    // Adjust translation based on direction
    if (moveUp) {
        currSet.translation[1] += moveSpeed + 0.1; // Move right
    }

    // Check if any triangle hits the boundary (assume [-1, 1] normalized device coords)
    var newPosX = currSet.center[1] + currSet.translation[1];
    if (newPosX >= 1.5 || newPosX <= -0.5) {
        boundaryHit = true;
        // console.log("bingo") 
    }

    // Reverse direction if boundary is hit
    if (boundaryHit) {
        resetBullet();
        return;
    }
}

function updateAlienBulletTranslation(bulletIndex, alienIndex, translationX) {
    boundaryHitAlienBullet = false;

    var currSet = inputTriangles[bulletIndex];
    currSet.isAlienBulletTranslationEnabled = true;

    // Adjust translation based on direction
    if (moveDown) {
        currSet.translation[0] = translationX;
        currSet.translation[1] += moveDownSpeed; // Move right
    }

    // Check if any triangle hits the boundary (assume [-1, 1] normalized device coords)
    var newPosX = currSet.center[1] + currSet.translation[1];
    if (newPosX >= 1.5 || newPosX <= -0.5) {
        boundaryHitAlienBullet = true;
        // console.log("bingo") 
    }

    // Reverse direction if boundary is hit
    if (boundaryHitAlienBullet) {
        currSet.visible = false;
        resetAlienBullet(bulletIndex, alienIndex);
        return;
    }
}

function resetBullet() {
    bulletFire = 0; // Stop bullet firing
    let bullet = inputTriangles[1];
    let spaceship = inputTriangles[0];

    // Reset bullet position to spaceship
    bullet.translation[1] = spaceship.translation[1];
    bullet.translation[0] = spaceship.translation[0];

    clearInterval(translationIntervalId); // Stop the bullet movement interval
}

function resetAlienBullet(bulletIndex, alienIndex) {
    bulletFire = 0; // Stop bullet firing
    let bullet = inputTriangles[bulletIndex];
    let spaceship = inputTriangles[alienIndex];

    // Reset bullet position to spaceship
    bullet.translation[1] = spaceship.translation[1];
    bullet.translation[0] = spaceship.translation[0];

    clearInterval(translationAlienIntervalId); // Stop the bullet movement interval
}


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    renderModels(); // draw the triangles using webGL
    setInterval(updateTranslations, 100);
    setInterval(checkCollisionBulletWithAlien,100);
    requestAnimationFrame(updateSinusoidalTranslation);
    // requestAnimationFrame(updateAlienBulletTranslation);
    // startAlienTranslationUpdates();
    // updateAlienBulletTranslation();
    dropAliens();
    
  
} // end main
