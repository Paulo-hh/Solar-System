"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec4 a_color;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}
`;

var fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

uniform vec4 u_colorMult;
uniform vec4 u_colorOffset;

out vec4 outColor;

void main() {
   outColor = v_color * u_colorMult + u_colorOffset;
}
`;

var Node = function() {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function(parent) {
  // remove us from our parent
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }

  // Add us to our new parent
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {
  if (matrix) {
    // a matrix was passed in so do the math
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    // no matrix was passed in so just copy.
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  // now process all the children
  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};

var a = 3;
var b = 3;
var c = 3;

function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position, n
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 36, 60); // ( gl , escala , numero de lados das esferas , resolução )

  // setup GLSL program
  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var objectsToDraw = [];
  var objects = [];

  // Let's make all the nodes
  var solarSystemNode = new Node();
  var earthOrbitNode = new Node();
  // earth orbit 100 units from the sun
  earthOrbitNode.localMatrix = m4.translation(500, 0, 0);

  var moonOrbitNode = new Node();
  // moon 20 units from the earth
  moonOrbitNode.localMatrix = m4.translation(50, 0, 0);

  var venusOrbitNode = new Node();
  venusOrbitNode.localMatrix = m4.translation(300, 0, 0);

  var mercuryOrbitNode = new Node();
  mercuryOrbitNode.localMatrix = m4.translation(150, 0, 0);

  var marsOrbitNode = new Node();
  marsOrbitNode.localMatrix = m4.translation(650, 0, 0);

  var sunNode = new Node();
  sunNode.localMatrix = m4.scaling(5, 5, 5);  // sun a the center
  sunNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0, 1], // yellow
      u_colorMult:   [0.4, 0.4, 0, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var earthNode = new Node();

  // make the earth twice as large
  earthNode.localMatrix = m4.scaling(2, 2, 2);   // make the earth twice as large
  earthNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.2, 0.5, 0.8, 1],  // blue-green
      u_colorMult:   [0.8, 0.5, 0.2, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var moonNode = new Node();
  moonNode.localMatrix = m4.scaling(0.4, 0.4, 0.4);
  moonNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.6, 0.6, 1],  // gray
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var venusNode = new Node();
  venusNode.localMatrix = m4.scaling(1.8, 1.8, 1.8);
  venusNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.9, 0.5, 0.1, 1],  // orange-brown
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var mercuryNode = new Node();
  mercuryNode.localMatrix = m4.scaling(1, 1, 1);
  mercuryNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.6, 0.5, 0.2, 1],  // gray
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var marsNode = new Node();
  marsNode.localMatrix = m4.scaling(1.4, 1.4, 1.4);
  marsNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0.9, 0.1, 0.2, 1],  // red
      u_colorMult:   [0.1, 0.1, 0.1, 1],
    },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  // connect the celetial objects
  sunNode.setParent(solarSystemNode);
  earthOrbitNode.setParent(solarSystemNode);
  earthNode.setParent(earthOrbitNode);
  moonOrbitNode.setParent(earthOrbitNode);
  moonNode.setParent(moonOrbitNode);
  venusOrbitNode.setParent(solarSystemNode);
  venusNode.setParent(venusOrbitNode);
  mercuryOrbitNode.setParent(solarSystemNode);
  mercuryNode.setParent(mercuryOrbitNode);
  marsOrbitNode.setParent(solarSystemNode);
  marsNode.setParent(marsOrbitNode);

  var objects = [
    sunNode,
    earthNode,
    moonNode,
    venusNode,
    mercuryNode,
    marsNode,
  ];

  var objectsToDraw = [
    sunNode.drawInfo,
    earthNode.drawInfo,
    moonNode.drawInfo,
    venusNode.drawInfo,
    mercuryNode.drawInfo,
    marsNode.drawInfo,
  ];

  requestAnimationFrame(drawScene);

  // Draw the scene.
  function drawScene(time) {
    time *= 0.001;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Clear the canvas AND the depth buffer.
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    document.addEventListener('keydown', function(event) {
      if (event.key === 'w') {
        // Ação a ser executada quando "w" é pressionado
        b += 0.01;
      }
      if (event.key === 's') {
        // Ação a ser executada quando "s" é pressionado
        b -= 0.01;
      }
      if (event.key === 'a') {
        // Ação a ser executada quando "a" é pressionado
        a += 0.01;
      }
      if (event.key === 'd') {
        // Ação a ser executada quando "d" é pressionado
        a -= 0.01;
      }
      if (event.key === 'q') {
        // Ação a ser executada quando "q" é pressionado
        c += 0.01;
      }
      if (event.key === 'e') {
        // Ação a ser executada quando "e" é pressionado
        c -= 0.01;
      }

    });

    // Compute the camera's matrix using look at.
    var cameraPosition = [0 + a, -800 + b, 0 + c];      // posição da camera em relação ao sol
    var target = [0, 0, 0];
    var up = [0, 0, 1];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    // update the local matrices for each object.
    m4.multiply(m4.yRotation(0.01), earthOrbitNode.localMatrix, earthOrbitNode.localMatrix);  // velocidade rotação da terra em torno da lua
    m4.multiply(m4.yRotation(0.1), moonOrbitNode.localMatrix, moonOrbitNode.localMatrix);
    m4.multiply(m4.yRotation(0.0062), venusOrbitNode.localMatrix, venusOrbitNode.localMatrix);
    m4.multiply(m4.yRotation(0.0024), mercuryOrbitNode.localMatrix, mercuryOrbitNode.localMatrix);
    m4.multiply(m4.yRotation(0.0188), marsOrbitNode.localMatrix, marsOrbitNode.localMatrix);

    // spin the sun
    m4.multiply(m4.yRotation(0.005), sunNode.localMatrix, sunNode.localMatrix);
    // spin the earth
    m4.multiply(m4.yRotation(0.05), earthNode.localMatrix, earthNode.localMatrix);
    // spin the moon
    m4.multiply(m4.yRotation(-0.01), moonNode.localMatrix, moonNode.localMatrix);
    // spin the venus
    m4.multiply(m4.yRotation(0.05), venusNode.localMatrix, venusNode.localMatrix);
    // spin the mercury
    m4.multiply(m4.yRotation(0.05), mercuryNode.localMatrix, mercuryNode.localMatrix);
    // spin the mars
    m4.multiply(m4.yRotation(0.05), marsNode.localMatrix, marsNode.localMatrix);

    // Update all world matrices in the scene graph
    solarSystemNode.updateWorldMatrix();

    // Compute all the matrices for rendering
    objects.forEach(function(object) {
        object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
    });

    // ------ Draw the objects --------

    twgl.drawObjectList(gl, objectsToDraw);

    requestAnimationFrame(drawScene);
  }
}

main();
