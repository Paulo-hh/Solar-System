"use strict";

var vs = `#version 300 es

in vec4 a_position;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
  gl_Position = u_matrix * a_position;
  v_texcoord = a_texcoord;
}
`;


var fs = `#version 300 es
precision highp float;

in vec2 v_texcoord;

uniform sampler2D u_texture;
uniform vec4 u_color;
uniform bool u_useTexture; 

out vec4 outColor;

void main() {
  if (u_useTexture) {
    outColor = texture(u_texture, v_texcoord);
  } else {
    outColor = u_color;
  }
}
`;

var Node = function() {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
};

Node.prototype.setParent = function(parent) {
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }

  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(matrix) {
  if (matrix) {
    m4.multiply(matrix, this.localMatrix, this.worldMatrix);
  } else {
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};

// para camera
let cameraAngleX = 0;
let cameraAngleY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// tempo de animação
let time = 0;
let timeFactor = 1.0;
let isPaused = false;
let lastTime = 0;
let maxTime = 36525;
let currentTimeIndex = 0;


async function carregarTrajetoria(nomeArquivo) {
  const resposta = await fetch(nomeArquivo);
  const texto = await resposta.text();
  const linhas = texto.trim().split("\n");

  const posicoes = [];

  for (const linha of linhas) {
    const partes = linha.trim().split(/\s+/);
    if (partes.length >= 6) {
      const x = parseFloat(partes[3]) * 149.6;
      const y = parseFloat(partes[4]) * 149.6;
      const z = parseFloat(partes[5]) * 149.6;
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        posicoes.push({ x, y, z });
      }
    }
  }
  return posicoes;
}

let earthPositions = await carregarTrajetoria("Dados/Earth.txt");
let moonPositions = await carregarTrajetoria("Dados/Moon.txt");
let mercuryPositions = await carregarTrajetoria("Dados/Mercury.txt");
let venusPositions = await carregarTrajetoria("Dados/Venus.txt");
let marsPositions = await carregarTrajetoria("Dados/Mars.txt");
let jupiterPositions = await carregarTrajetoria("Dados/Jupiter.txt");
let saturnPositions = await carregarTrajetoria("Dados/Saturn.txt");
let uranusPositions = await carregarTrajetoria("Dados/Uranus.txt");
let neptunePositions = await carregarTrajetoria("Dados/Neptune.txt");
let plutoPositions = await carregarTrajetoria("Dados/Pluto.txt");
let voyager1Positions = await carregarTrajetoria("Dados/Voyager-1.txt");

function createOrbitLine(gl, programInfo, positions) {
  const linePositions = [];
  positions.forEach(p => {
    linePositions.push(p.x, p.y, p.z);
  });

  const lineBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: {
      numComponents: 3,
      data: linePositions,
    },
  });

  const lineVAO = twgl.createVAOFromBufferInfo(gl, programInfo, lineBufferInfo);
  return { bufferInfo: lineBufferInfo, vertexArray: lineVAO, numPoints: positions.length };
}


function main() {
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }
  
  const timeSlider = document.getElementById('timeSlider');
  const playPauseButton = document.getElementById('playPauseButton');
  const speedSlider = document.getElementById('speedSlider');

  maxTime = Math.max(earthPositions.length, moonPositions.length, mercuryPositions.length, venusPositions.length, marsPositions.length, jupiterPositions.length, saturnPositions.length, uranusPositions.length, neptunePositions.length, plutoPositions.length, voyager1Positions.length);
  timeSlider.max = maxTime - 1;

  playPauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    playPauseButton.textContent = isPaused ? 'Reproduzir' : 'Pausar';
  });

  timeSlider.addEventListener('input', (e) => {
    time = parseFloat(e.target.value);
    currentTimeIndex = Math.floor(time);
  });
  
  speedSlider.addEventListener('input', (e) => {
      timeFactor = parseFloat(e.target.value);
  });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      cameraAngleY += dx * 0.005;
      cameraAngleX += dy * 0.005;
      cameraAngleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleX));
    }
  });

  twgl.setAttributePrefix("a_");

  var programInfo = twgl.createProgramInfo(gl, [vs, fs]);
  var sphereBufferInfo = flattenedPrimitives.createSphereBufferInfo(gl, 10, 36, 60);
  var sphereVAO = twgl.createVAOFromBufferInfo(gl, programInfo, sphereBufferInfo);

  const matrixUniformLocation = gl.getUniformLocation(programInfo.program, 'u_matrix');
  const colorUniformLocation = gl.getUniformLocation(programInfo.program, 'u_color');
  const useTextureUniformLocation = gl.getUniformLocation(programInfo.program, 'u_useTexture'); 

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var sunTexture = twgl.createTexture(gl, { src: 'Texturas/sun.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var earthTexture = twgl.createTexture(gl, { src: 'Texturas/earth.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var mercuryTexture = twgl.createTexture(gl, { src: 'Texturas/mercury.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var venusTexture = twgl.createTexture(gl, { src: 'Texturas/venus.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var moonTexture = twgl.createTexture(gl, { src: 'Texturas/moon.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var marsTexture = twgl.createTexture(gl, { src: 'Texturas/mars.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var jupiterTexture = twgl.createTexture(gl, { src: 'Texturas/jupiter.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var saturnTexture = twgl.createTexture(gl, { src: 'Texturas/saturn.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var uranusTexture = twgl.createTexture(gl, { src: 'Texturas/uranus.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var neptuneTexture = twgl.createTexture(gl, { src: 'Texturas/neptune.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var plutoTexture = twgl.createTexture(gl, { src: 'Texturas/pluto.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
  var voyager1Texture = twgl.createTexture(gl, { src: 'Texturas/voyager1.jpg', minMag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });


  var fieldOfViewRadians = degToRad(60);

  var solarSystemNode = new Node();
  var earthOrbitNode = new Node();
  var moonOrbitNode = new Node();
  var venusOrbitNode = new Node();
  var mercuryOrbitNode = new Node();
  var marsOrbitNode = new Node();
  var jupiterOrbitNode = new Node();
  var saturnOrbitNode = new Node();
  var uranusOrbitNode = new Node();
  var neptuneOrbitNode = new Node();
  var plutoOrbitNode = new Node();
  var voyager1OrbitNode = new Node();

  var sunNode = new Node();
  sunNode.localMatrix = m4.scaling(2, 2, 2);
  sunNode.drawInfo = {
    uniforms: { u_texture: sunTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var earthNode = new Node();
  earthNode.localMatrix = m4.scaling(0.25, 0.25, 0.25);
  earthNode.drawInfo = {
    uniforms: { u_texture: earthTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var moonNode = new Node();
  moonNode.localMatrix = m4.scaling(0.05, 0.05, 0.05);
  moonNode.drawInfo = {
    uniforms: { u_texture: moonTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  };

  var venusNode = new Node();
  venusNode.localMatrix = m4.scaling(0.22, 0.22, 0.22);
  venusNode.drawInfo = {
    uniforms: { u_texture: venusTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var mercuryNode = new Node();
  mercuryNode.localMatrix = m4.scaling(0.13, 0.13, 0.13);
  mercuryNode.drawInfo = {
    uniforms: { u_texture: mercuryTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var marsNode = new Node();
  marsNode.localMatrix = m4.scaling(0.17, 0.17, 0.17);
  marsNode.drawInfo = {
    uniforms: { u_texture: marsTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var jupiterNode = new Node();
  jupiterNode.localMatrix = m4.scaling(0.9, 0.9, 0.9);
  jupiterNode.drawInfo = {
    uniforms: { u_texture: jupiterTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var saturnNode = new Node();
  saturnNode.localMatrix = m4.scaling(0.6, 0.6, 0.6);
  saturnNode.drawInfo = {
    uniforms: { u_texture: saturnTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var uranusNode = new Node();
  uranusNode.localMatrix = m4.scaling(0.35, 0.35, 0.35);
  uranusNode.drawInfo = {
    uniforms: { u_texture: uranusTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var neptuneNode = new Node();
  neptuneNode.localMatrix = m4.scaling(0.3, 0.3, 0.3);
  neptuneNode.drawInfo = {
    uniforms: { u_texture: neptuneTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var plutoNode = new Node();
  plutoNode.localMatrix = m4.scaling(0.2, 0.2, 0.2);
  plutoNode.drawInfo = {
    uniforms: { u_texture: plutoTexture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  var voyager1Node = new Node();
  voyager1Node.localMatrix = m4.scaling(0.3, 0.3, 0.3);
  voyager1Node.drawInfo = {
    uniforms: { u_texture: voyager1Texture, },
    programInfo: programInfo,
    bufferInfo: sphereBufferInfo,
    vertexArray: sphereVAO,
  }

  sunNode.setParent(solarSystemNode);
  earthOrbitNode.setParent(solarSystemNode);
  earthNode.setParent(earthOrbitNode);
  moonOrbitNode.setParent(solarSystemNode);
  moonNode.setParent(moonOrbitNode);
  venusOrbitNode.setParent(solarSystemNode);
  venusNode.setParent(venusOrbitNode);
  mercuryOrbitNode.setParent(solarSystemNode);
  mercuryNode.setParent(mercuryOrbitNode);
  marsOrbitNode.setParent(solarSystemNode);
  marsNode.setParent(marsOrbitNode);
  jupiterOrbitNode.setParent(solarSystemNode);
  jupiterNode.setParent(jupiterOrbitNode);
  saturnOrbitNode.setParent(solarSystemNode);
  saturnNode.setParent(saturnOrbitNode);
  uranusOrbitNode.setParent(solarSystemNode);
  uranusNode.setParent(uranusOrbitNode);
  neptuneOrbitNode.setParent(solarSystemNode);
  neptuneNode.setParent(neptuneOrbitNode);
  plutoOrbitNode.setParent(solarSystemNode);
  plutoNode.setParent(plutoOrbitNode);
  voyager1OrbitNode.setParent(solarSystemNode);
  voyager1Node.setParent(voyager1OrbitNode);

  var objects = [
    sunNode, earthNode, moonNode, venusNode, mercuryNode, marsNode,
    jupiterNode, saturnNode, uranusNode, neptuneNode, plutoNode, voyager1Node
  ];

  var objectsToDraw = [
    sunNode.drawInfo, earthNode.drawInfo, moonNode.drawInfo, venusNode.drawInfo, mercuryNode.drawInfo, marsNode.drawInfo,
    jupiterNode.drawInfo, saturnNode.drawInfo, uranusNode.drawInfo, neptuneNode.drawInfo, plutoNode.drawInfo, voyager1Node.drawInfo
  ];

  // Adicionando as órbitas
  const earthOrbit = createOrbitLine(gl, programInfo, earthPositions);
  const moonOrbit = createOrbitLine(gl, programInfo, moonPositions);
  const mercuryOrbit = createOrbitLine(gl, programInfo, mercuryPositions);
  const venusOrbit = createOrbitLine(gl, programInfo, venusPositions);
  const marsOrbit = createOrbitLine(gl, programInfo, marsPositions);
  const jupiterOrbit = createOrbitLine(gl, programInfo, jupiterPositions);
  const saturnOrbit = createOrbitLine(gl, programInfo, saturnPositions);
  const uranusOrbit = createOrbitLine(gl, programInfo, uranusPositions);
  const neptuneOrbit = createOrbitLine(gl, programInfo, neptunePositions);
  const plutoOrbit = createOrbitLine(gl, programInfo, plutoPositions);
  const voyager1Orbit = createOrbitLine(gl, programInfo, voyager1Positions);

  const orbitsToDraw = [
      {
          programInfo: programInfo,
          vertexArray: mercuryOrbit.vertexArray,
          bufferInfo: mercuryOrbit.bufferInfo,
          uniforms: { u_color: [0.3, 0.1, 0.4, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: venusOrbit.vertexArray,
          bufferInfo: venusOrbit.bufferInfo,
          uniforms: { u_color: [0.6, 0.1, 0.3, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: earthOrbit.vertexArray,
          bufferInfo: earthOrbit.bufferInfo,
          uniforms: { u_color: [0.6, 0.3, 0.1, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: moonOrbit.vertexArray,
          bufferInfo: moonOrbit.bufferInfo,
          uniforms: { u_color: [0.7, 0.5, 0.3, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: marsOrbit.vertexArray,
          bufferInfo: marsOrbit.bufferInfo,
          uniforms: { u_color: [0.2, 0.5, 0.2, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: jupiterOrbit.vertexArray,
          bufferInfo: jupiterOrbit.bufferInfo,
          uniforms: { u_color: [0.6, 0.1, 0.5, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: saturnOrbit.vertexArray,
          bufferInfo: saturnOrbit.bufferInfo,
          uniforms: { u_color: [0.5, 0.7, 0.2, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: uranusOrbit.vertexArray,
          bufferInfo: uranusOrbit.bufferInfo,
          uniforms: { u_color: [0.3, 0.6, 0.6, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: neptuneOrbit.vertexArray,
          bufferInfo: neptuneOrbit.bufferInfo,
          uniforms: { u_color: [0.7, 0.7, 0.2, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: plutoOrbit.vertexArray,
          bufferInfo: plutoOrbit.bufferInfo,
          uniforms: { u_color: [0.1, 0.5, 0.1, 1], u_texture: null },
      },
      {
          programInfo: programInfo,
          vertexArray: voyager1Orbit.vertexArray,
          bufferInfo: voyager1Orbit.bufferInfo,
          uniforms: { u_color: [0.7, 0.2, 0.3, 1], u_texture: null },
      },
  ];

  requestAnimationFrame(drawScene);

  function drawScene(now) {
    if (!isPaused) {
      const deltaTime = (now - lastTime) * timeFactor;
      time += deltaTime * 0.001;
      if (time >= maxTime - 1) {
          time = 0;
      }
      currentTimeIndex = Math.floor(time);
      timeSlider.value = currentTimeIndex;
    }
    lastTime = now;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    const radius = 200;
    const x = radius * Math.cos(cameraAngleX) * Math.sin(cameraAngleY);
    const y = radius * Math.sin(cameraAngleX);
    const z = radius * Math.cos(cameraAngleX) * Math.cos(cameraAngleY);

    var cameraPosition = [x, y, z];
    let opcaoSelecionada = document.getElementById('verPlaneta');
    let elementoSelecionado = opcaoSelecionada.value;
    var target = [0, 0, 0];

    const currentEarthIndex = currentTimeIndex % earthPositions.length;
    if (earthPositions.length > 0) {
      const pos = earthPositions[currentEarthIndex];
      if(elementoSelecionado == 'earth'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      earthOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentMoonIndex = currentTimeIndex % moonPositions.length;
    if (moonPositions.length > 0) {
      const pos = moonPositions[currentMoonIndex];
      if(elementoSelecionado == 'moon'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      moonOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }
    
    const currentMercuryIndex = currentTimeIndex % mercuryPositions.length;
    if (mercuryPositions.length > 0) {
      const pos = mercuryPositions[currentMercuryIndex];
      if(elementoSelecionado == 'mercury'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      mercuryOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentVenusIndex = currentTimeIndex % venusPositions.length;
    if (venusPositions.length > 0) {
      const pos = venusPositions[currentVenusIndex];
      if(elementoSelecionado == 'venus'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      venusOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }
    
    const currentMarsIndex = currentTimeIndex % marsPositions.length;
    if (marsPositions.length > 0) {
      const pos = marsPositions[currentMarsIndex];
      if(elementoSelecionado == 'mars'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      marsOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentJupiterIndex = currentTimeIndex % jupiterPositions.length;
    if (jupiterPositions.length > 0) {
      const pos = jupiterPositions[currentJupiterIndex];
      if(elementoSelecionado == 'jupiter'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      jupiterOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }
    
    const currentSaturnIndex = currentTimeIndex % saturnPositions.length;
    if (saturnPositions.length > 0) {
      const pos = saturnPositions[currentSaturnIndex];
      if(elementoSelecionado == 'saturn'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      saturnOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentUranusIndex = currentTimeIndex % uranusPositions.length;
    if (uranusPositions.length > 0) {
      const pos = uranusPositions[currentUranusIndex];
      if(elementoSelecionado == 'uranus'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      uranusOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentNeptuneIndex = currentTimeIndex % neptunePositions.length;
    if (neptunePositions.length > 0) {
      const pos = neptunePositions[currentNeptuneIndex];
      if(elementoSelecionado == 'neptune'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      neptuneOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentPlutoIndex = currentTimeIndex % plutoPositions.length;
    if (plutoPositions.length > 0) {
      const pos = plutoPositions[currentPlutoIndex];
      if(elementoSelecionado == 'pluto'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      plutoOrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    const currentVoyagerIndex = currentTimeIndex % voyager1Positions.length;
    if (voyager1Positions.length > 0) {
      const pos = voyager1Positions[currentVoyagerIndex];
      if(elementoSelecionado == 'voyager1'){
        cameraPosition = [x + pos.x, y + pos.y, z + pos.z];
        target = [pos.x, pos.y, pos.z];
      }
      voyager1OrbitNode.localMatrix = m4.translation(pos.x, pos.y, pos.z);
    }

    m4.multiply(m4.yRotation(0.005), sunNode.localMatrix, sunNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), earthNode.localMatrix, earthNode.localMatrix);
    m4.multiply(m4.yRotation(-0.01), moonNode.localMatrix, moonNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), venusNode.localMatrix, venusNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), mercuryNode.localMatrix, mercuryNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), marsNode.localMatrix, marsNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), jupiterNode.localMatrix, jupiterNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), saturnNode.localMatrix, saturnNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), uranusNode.localMatrix, uranusNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), neptuneNode.localMatrix, neptuneNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), plutoNode.localMatrix, plutoNode.localMatrix);
    m4.multiply(m4.yRotation(0.05), voyager1Node.localMatrix, voyager1Node.localMatrix);

    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);
    var viewMatrix = m4.inverse(cameraMatrix);
    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    solarSystemNode.updateWorldMatrix();
    
    // Desenhar órbitas
    gl.useProgram(programInfo.program);
orbitsToDraw.forEach(o => {
  gl.uniform1i(useTextureUniformLocation, false); 
  gl.uniformMatrix4fv(matrixUniformLocation, false, viewProjectionMatrix);
  gl.uniform4fv(colorUniformLocation, o.uniforms.u_color);
  gl.bindVertexArray(o.vertexArray);
  gl.drawArrays(gl.LINE_STRIP, 0, o.bufferInfo.numElements);
});

objects.forEach(function(object) {
  object.drawInfo.uniforms.u_matrix = m4.multiply(viewProjectionMatrix, object.worldMatrix);
  object.drawInfo.uniforms.u_useTexture = true; 
});

twgl.drawObjectList(gl, objectsToDraw);

    requestAnimationFrame(drawScene);
  }
}

main();