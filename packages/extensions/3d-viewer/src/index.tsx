import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Preview, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: number;
  extension?: string;
}

interface ParsedModel {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  bounds: BoundingBox;
}

interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

// ── Constants ───────────────────────────────────────────────────────────────

const MODEL_EXTENSIONS = new Set(['stl', 'obj']);

// ── Vec3 / Mat4 Math ────────────────────────────────────────────────────────

function v3sub(a: number[], b: number[]): number[] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function v3add(a: number[], b: number[]): number[] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function v3scale(v: number[], s: number): number[] {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function v3cross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function v3dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function v3len(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function v3normalize(v: number[]): number[] {
  const l = v3len(v);
  if (l < 1e-10) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

function mat4identity(): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

function mat4perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const m = new Float32Array(16);
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

function mat4lookAt(eye: number[], center: number[], up: number[]): Float32Array {
  const z = v3normalize(v3sub(eye, center));
  const x = v3normalize(v3cross(up, z));
  const y = v3cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0];
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1];
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
  m[12] = -v3dot(x, eye);
  m[13] = -v3dot(y, eye);
  m[14] = -v3dot(z, eye);
  m[15] = 1;
  return m;
}

function mat4multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[4 + i] * b[j * 4 + 1] +
        a[8 + i] * b[j * 4 + 2] +
        a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}

function mat4rotateX(angle: number): Float32Array {
  const m = mat4identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  m[5] = c; m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}

function mat4rotateY(angle: number): Float32Array {
  const m = mat4identity();
  const c = Math.cos(angle), s = Math.sin(angle);
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}

function mat4translate(tx: number, ty: number, tz: number): Float32Array {
  const m = mat4identity();
  m[12] = tx; m[13] = ty; m[14] = tz;
  return m;
}

function mat4scale(sx: number, sy: number, sz: number): Float32Array {
  const m = new Float32Array(16);
  m[0] = sx; m[5] = sy; m[10] = sz; m[15] = 1;
  return m;
}

function mat4inverse(m: Float32Array): Float32Array {
  const inv = new Float32Array(16);
  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) return mat4identity();
  det = 1.0 / det;

  inv[0] = (m11 * b11 - m12 * b10 + m13 * b09) * det;
  inv[1] = (m02 * b10 - m01 * b11 - m03 * b09) * det;
  inv[2] = (m31 * b05 - m32 * b04 + m33 * b03) * det;
  inv[3] = (m22 * b04 - m21 * b05 - m23 * b03) * det;
  inv[4] = (m12 * b08 - m10 * b11 - m13 * b07) * det;
  inv[5] = (m00 * b11 - m02 * b08 + m03 * b07) * det;
  inv[6] = (m32 * b02 - m30 * b05 - m33 * b01) * det;
  inv[7] = (m20 * b05 - m22 * b02 + m23 * b01) * det;
  inv[8] = (m10 * b10 - m11 * b08 + m13 * b06) * det;
  inv[9] = (m01 * b08 - m00 * b10 - m03 * b06) * det;
  inv[10] = (m30 * b04 - m31 * b02 + m33 * b00) * det;
  inv[11] = (m21 * b02 - m20 * b04 - m23 * b00) * det;
  inv[12] = (m11 * b07 - m10 * b09 - m12 * b06) * det;
  inv[13] = (m00 * b09 - m01 * b07 + m02 * b06) * det;
  inv[14] = (m31 * b01 - m30 * b03 - m32 * b00) * det;
  inv[15] = (m20 * b03 - m21 * b01 + m22 * b00) * det;
  return inv;
}

function mat4transpose(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  out[0] = m[0]; out[1] = m[4]; out[2] = m[8]; out[3] = m[12];
  out[4] = m[1]; out[5] = m[5]; out[6] = m[9]; out[7] = m[13];
  out[8] = m[2]; out[9] = m[6]; out[10] = m[10]; out[11] = m[14];
  out[12] = m[3]; out[13] = m[7]; out[14] = m[11]; out[15] = m[15];
  return out;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

function computeBounds(verts: number[]): BoundingBox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      if (verts[i + j] < min[j]) min[j] = verts[i + j];
      if (verts[i + j] > max[j]) max[j] = verts[i + j];
    }
  }
  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

function computeFaceNormal(v0: number[], v1: number[], v2: number[]): number[] {
  const e1 = v3sub(v1, v0);
  const e2 = v3sub(v2, v0);
  return v3normalize(v3cross(e1, e2));
}

function isAsciiSTL(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength));
  let str = '';
  for (let i = 0; i < header.length; i++) {
    str += String.fromCharCode(header[i]);
  }
  return str.trimStart().startsWith('solid') && buffer.byteLength > 84 &&
    new DataView(buffer).getUint32(80, true) === 0 ||
    str.includes('facet');
}

function parseSTLBinary(buffer: ArrayBuffer): ParsedModel {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const verts: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];

  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    const baseIdx = verts.length / 3;
    for (let v = 0; v < 3; v++) {
      verts.push(
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      );
      norms.push(nx, ny, nz);
      offset += 12;
    }
    offset += 2; // attribute byte count

    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
  }

  const bounds = computeBounds(verts);
  return {
    vertices: new Float32Array(verts),
    normals: new Float32Array(norms),
    indices: new Uint32Array(indices),
    vertexCount: verts.length / 3,
    triangleCount,
    bounds,
  };
}

function parseSTLAscii(text: string): ParsedModel {
  const verts: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];
  let currentNormal: number[] = [0, 0, 1];
  let faceVerts: number[][] = [];
  let triangleCount = 0;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
      faceVerts = [];
    } else if (line.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      faceVerts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (line.startsWith('endfacet') && faceVerts.length >= 3) {
      const baseIdx = verts.length / 3;
      for (let v = 0; v < 3; v++) {
        verts.push(faceVerts[v][0], faceVerts[v][1], faceVerts[v][2]);
        norms.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      }
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      triangleCount++;
    }
  }

  const bounds = computeBounds(verts);
  return {
    vertices: new Float32Array(verts),
    normals: new Float32Array(norms),
    indices: new Uint32Array(indices),
    vertexCount: verts.length / 3,
    triangleCount,
    bounds,
  };
}

function parseSTL(buffer: ArrayBuffer): ParsedModel {
  const text = new TextDecoder().decode(buffer);
  if (text.trimStart().startsWith('solid') && text.includes('facet')) {
    const asciiResult = parseSTLAscii(text);
    if (asciiResult.triangleCount > 0) return asciiResult;
  }
  return parseSTLBinary(buffer);
}

function parseOBJ(text: string): ParsedModel {
  const positions: number[][] = [];
  const objNormals: number[][] = [];
  const verts: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];
  let triangleCount = 0;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('#') || line.length === 0) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === 'v' && parts.length >= 4) {
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (keyword === 'vn' && parts.length >= 4) {
      objNormals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (keyword === 'f' && parts.length >= 4) {
      const facePositions: number[][] = [];
      const faceNormals: number[][] = [];

      for (let i = 1; i < parts.length; i++) {
        const indices_str = parts[i].split('/');
        const vIdx = parseInt(indices_str[0], 10);
        const pi = vIdx > 0 ? vIdx - 1 : positions.length + vIdx;
        if (pi >= 0 && pi < positions.length) {
          facePositions.push(positions[pi]);
        }

        if (indices_str.length >= 3 && indices_str[2] !== '') {
          const nIdx = parseInt(indices_str[2], 10);
          const ni = nIdx > 0 ? nIdx - 1 : objNormals.length + nIdx;
          if (ni >= 0 && ni < objNormals.length) {
            faceNormals.push(objNormals[ni]);
          }
        }
      }

      if (facePositions.length < 3) continue;

      // Triangulate polygon (fan triangulation)
      const faceNormal = faceNormals.length === facePositions.length
        ? null
        : computeFaceNormal(facePositions[0], facePositions[1], facePositions[2]);

      for (let i = 1; i < facePositions.length - 1; i++) {
        const triIndices = [0, i, i + 1];
        const baseIdx = verts.length / 3;

        for (const ti of triIndices) {
          verts.push(facePositions[ti][0], facePositions[ti][1], facePositions[ti][2]);
          if (faceNormals.length === facePositions.length) {
            norms.push(faceNormals[ti][0], faceNormals[ti][1], faceNormals[ti][2]);
          } else if (faceNormal) {
            norms.push(faceNormal[0], faceNormal[1], faceNormal[2]);
          } else {
            norms.push(0, 0, 1);
          }
        }

        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        triangleCount++;
      }
    }
  }

  const bounds = computeBounds(verts);
  return {
    vertices: new Float32Array(verts),
    normals: new Float32Array(norms),
    indices: new Uint32Array(indices),
    vertexCount: verts.length / 3,
    triangleCount,
    bounds,
  };
}

// ── WebGL Renderer ──────────────────────────────────────────────────────────

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uModelView;
uniform mat4 uNormalMatrix;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec4 mvPosition = uModelView * vec4(aPosition, 1.0);
  vPosition = mvPosition.xyz;
  vNormal = (uNormalMatrix * vec4(aNormal, 0.0)).xyz;
  gl_Position = uProjection * mvPosition;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec3 uLightDir;
uniform vec3 uColor;
uniform vec3 uAmbient;
uniform float uShininess;
void main() {
  vec3 normal = normalize(vNormal);
  // Flip normal if back-facing
  if (!gl_FrontFacing) normal = -normal;
  vec3 lightDir = normalize(uLightDir);
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 viewDir = normalize(-vPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), uShininess);
  vec3 color = uAmbient * uColor + diff * uColor * 0.7 + spec * vec3(0.3);
  gl_FragColor = vec4(color, 1.0);
}
`;

const WIREFRAME_VERTEX_SHADER = `
attribute vec3 aPosition;
uniform mat4 uProjection;
uniform mat4 uModelView;
void main() {
  gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
}
`;

const WIREFRAME_FRAGMENT_SHADER = `
precision mediump float;
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vertShader || !fragShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function buildWireframeIndices(indices: Uint32Array): Uint32Array {
  const lines: number[] = [];
  const edgeSet = new Set<string>();
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const edges: [number, number][] = [[a, b], [b, c], [c, a]];
    for (const [e0, e1] of edges) {
      const key = e0 < e1 ? `${e0}-${e1}` : `${e1}-${e0}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        lines.push(e0, e1);
      }
    }
  }
  return new Uint32Array(lines);
}

interface GLState {
  gl: WebGLRenderingContext;
  solidProgram: WebGLProgram;
  wireProgram: WebGLProgram;
  vertexBuffer: WebGLBuffer;
  normalBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  wireIndexBuffer: WebGLBuffer;
  triangleCount: number;
  wireIndexCount: number;
}

function initGL(canvas: HTMLCanvasElement, model: ParsedModel): GLState | null {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;

  const ext = gl.getExtension('OES_element_index_uint');
  if (!ext) {
    console.warn('OES_element_index_uint not available, large models may fail');
  }

  const solidProgram = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const wireProgram = createProgram(gl, WIREFRAME_VERTEX_SHADER, WIREFRAME_FRAGMENT_SHADER);
  if (!solidProgram || !wireProgram) return null;

  const vertexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

  const wireIndices = buildWireframeIndices(model.indices);
  const wireIndexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  return {
    gl,
    solidProgram,
    wireProgram,
    vertexBuffer,
    normalBuffer,
    indexBuffer,
    wireIndexBuffer,
    triangleCount: model.triangleCount,
    wireIndexCount: wireIndices.length,
  };
}

function renderScene(
  state: GLState,
  projection: Float32Array,
  modelView: Float32Array,
  wireframe: boolean,
  bgColor: [number, number, number],
  modelColor: [number, number, number],
) {
  const { gl } = state;
  gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (wireframe) {
    gl.useProgram(state.wireProgram);
    const posLoc = gl.getAttribLocation(state.wireProgram, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, state.vertexBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(gl.getUniformLocation(state.wireProgram, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(state.wireProgram, 'uModelView'), false, modelView);
    gl.uniform3fv(gl.getUniformLocation(state.wireProgram, 'uColor'), modelColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.wireIndexBuffer);
    gl.drawElements(gl.LINES, state.wireIndexCount, gl.UNSIGNED_INT, 0);
  } else {
    gl.useProgram(state.solidProgram);
    const posLoc = gl.getAttribLocation(state.solidProgram, 'aPosition');
    const normLoc = gl.getAttribLocation(state.solidProgram, 'aNormal');

    gl.bindBuffer(gl.ARRAY_BUFFER, state.vertexBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, state.normalBuffer);
    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);

    const normalMatrix = mat4transpose(mat4inverse(modelView));
    gl.uniformMatrix4fv(gl.getUniformLocation(state.solidProgram, 'uProjection'), false, projection);
    gl.uniformMatrix4fv(gl.getUniformLocation(state.solidProgram, 'uModelView'), false, modelView);
    gl.uniformMatrix4fv(gl.getUniformLocation(state.solidProgram, 'uNormalMatrix'), false, normalMatrix);
    gl.uniform3fv(gl.getUniformLocation(state.solidProgram, 'uLightDir'), [0.5, 0.8, 1.0]);
    gl.uniform3fv(gl.getUniformLocation(state.solidProgram, 'uColor'), modelColor);
    gl.uniform3fv(gl.getUniformLocation(state.solidProgram, 'uAmbient'), [0.25, 0.25, 0.25]);
    gl.uniform1f(gl.getUniformLocation(state.solidProgram, 'uShininess'), 32.0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, state.indexBuffer);
    gl.drawElements(gl.TRIANGLES, state.triangleCount * 3, gl.UNSIGNED_INT, 0);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function isModelFile(path: string): boolean {
  return MODEL_EXTENSIONS.has(getExtension(path));
}

function formatDimension(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

function parseCssColor(cssValue: string): [number, number, number] {
  const el = document.createElement('div');
  el.style.color = cssValue;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);
  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255];
  }
  return [0.04, 0.04, 0.1];
}

// ── Inline SVG Icons ────────────────────────────────────────────────────────

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

// ── Viewer Component ────────────────────────────────────────────────────────

function ModelViewer({ filePath }: { filePath: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glStateRef = useRef<GLState | null>(null);
  const rafRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [modelInfo, setModelInfo] = useState<ParsedModel | null>(null);

  const rotationRef = useRef<{ x: number; y: number }>({ x: 0.4, y: 0.6 });
  const zoomRef = useRef<number>(1.0);
  const isDragging = useRef(false);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const modelBoundsRef = useRef<BoundingBox | null>(null);
  const wireframeRef = useRef(false);

  const resetView = useCallback(() => {
    rotationRef.current = { x: 0.4, y: 0.6 };
    zoomRef.current = 1.0;
  }, []);

  useEffect(() => {
    wireframeRef.current = wireframe;
  }, [wireframe]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setModelInfo(null);
    resetView();

    const ext = getExtension(filePath);

    api.files.read(filePath).then((buffer) => {
      if (cancelled) return;

      let model: ParsedModel;
      try {
        if (ext === 'stl') {
          model = parseSTL(buffer);
        } else if (ext === 'obj') {
          const text = new TextDecoder().decode(buffer);
          model = parseOBJ(text);
        } else {
          throw new Error(`Unsupported format: .${ext}`);
        }
      } catch (e) {
        setError(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
        setLoading(false);
        return;
      }

      if (model.triangleCount === 0) {
        setError('Model contains no triangles');
        setLoading(false);
        return;
      }

      setModelInfo(model);
      modelBoundsRef.current = model.bounds;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const glState = initGL(canvas, model);
      if (!glState) {
        setError('Failed to initialize WebGL');
        setLoading(false);
        return;
      }

      glStateRef.current = glState;
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setError(`Failed to read file: ${String(err)}`);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, resetView]);

  // Render loop
  useEffect(() => {
    const animate = () => {
      const glState = glStateRef.current;
      const canvas = canvasRef.current;
      const bounds = modelBoundsRef.current;
      if (!glState || !canvas || !bounds) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const drawWidth = Math.round(displayWidth * dpr);
      const drawHeight = Math.round(displayHeight * dpr);

      if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
        canvas.width = drawWidth;
        canvas.height = drawHeight;
      }
      glState.gl.viewport(0, 0, drawWidth, drawHeight);

      const aspect = displayWidth / Math.max(displayHeight, 1);
      const projection = mat4perspective(Math.PI / 4, aspect, 0.01, 1000);

      const maxDim = Math.max(bounds.size[0], bounds.size[1], bounds.size[2], 0.001);
      const scaleFactor = 2.0 / maxDim;
      const dist = 3.5 * zoomRef.current;

      const rx = rotationRef.current.x;
      const ry = rotationRef.current.y;
      const eyeX = dist * Math.sin(ry) * Math.cos(rx);
      const eyeY = dist * Math.sin(rx);
      const eyeZ = dist * Math.cos(ry) * Math.cos(rx);

      const view = mat4lookAt([eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
      const modelTranslate = mat4translate(
        -bounds.center[0] * scaleFactor,
        -bounds.center[1] * scaleFactor,
        -bounds.center[2] * scaleFactor,
      );
      const modelScale = mat4scale(scaleFactor, scaleFactor, scaleFactor);
      const modelMatrix = mat4multiply(modelTranslate, modelScale);
      const modelView = mat4multiply(view, modelMatrix);

      let bgColor: [number, number, number];
      try {
        const bgProp = getComputedStyle(document.documentElement).getPropertyValue('--xp-bg-primary').trim();
        bgColor = bgProp ? parseCssColor(bgProp) : parseCssColor(
          getComputedStyle(document.documentElement).getPropertyValue('--xp-bg').trim() || '#0a0a1a'
        );
      } catch {
        bgColor = [0.04, 0.04, 0.1];
      }

      const modelColor: [number, number, number] = [0.55, 0.65, 0.8];
      renderScene(glState, projection, modelView, wireframeRef.current, bgColor, modelColor);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Mouse interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    rotationRef.current = {
      x: Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationRef.current.x - dy * 0.005)),
      y: rotationRef.current.y + dx * 0.005,
    };
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.08 : 0.92;
    zoomRef.current = Math.max(0.1, Math.min(10.0, zoomRef.current * delta));
  }, []);

  const handleDoubleClick = useCallback(() => {
    resetView();
  }, [resetView]);

  const ext = getExtension(filePath).toUpperCase();
  const filename = filePath.split(/[/\\]/).pop() || '';

  const toolbarBtnStyle: React.CSSProperties = {
    background: 'var(--xp-surface-light, #1e1e2e)',
    border: '1px solid var(--xp-border, #333)',
    borderRadius: 4,
    color: 'var(--xp-text, #c0caf5)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: 12,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  };

  const activeBtnStyle: React.CSSProperties = {
    ...toolbarBtnStyle,
    background: 'var(--xp-blue, #7aa2f7)',
    color: '#fff',
    borderColor: 'var(--xp-blue, #7aa2f7)',
  };

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-red, #f7768e)', fontSize: 13 }}>
        {`Error: ${error}`}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--xp-border, #333)',
        fontSize: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => setWireframe(false)}
            style={!wireframe ? activeBtnStyle : toolbarBtnStyle}
            title="Solid shading"
          >
            <CubeIcon />
            <span>Solid</span>
          </button>
          <button
            onClick={() => setWireframe(true)}
            style={wireframe ? activeBtnStyle : toolbarBtnStyle}
            title="Wireframe view"
          >
            <GridIcon />
            <span>Wire</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => { zoomRef.current = Math.max(0.1, zoomRef.current * 0.85); }}
            style={toolbarBtnStyle}
            title="Zoom in"
          >
            <ZoomInIcon />
          </button>
          <button
            onClick={() => { zoomRef.current = Math.min(10, zoomRef.current * 1.18); }}
            style={toolbarBtnStyle}
            title="Zoom out"
          >
            <ZoomOutIcon />
          </button>
          <button
            onClick={resetView}
            style={toolbarBtnStyle}
            title="Reset view"
          >
            <RotateIcon />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          cursor: isDragging.current ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {loading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--xp-text-muted, #888)', fontSize: 13,
            background: 'var(--xp-bg, #1a1b26)',
          }}>
            Loading model...
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* Info bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 10px', borderTop: '1px solid var(--xp-border, #333)',
        fontSize: 11, color: 'var(--xp-text-muted, #888)', flexShrink: 0,
      }}>
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const, flex: 1, marginRight: 8,
        }}>
          {filename}
        </span>
        <span style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
          <span>{ext}</span>
          {modelInfo && (
            <>
              <span>{`${modelInfo.vertexCount.toLocaleString()} verts`}</span>
              <span>{`${modelInfo.triangleCount.toLocaleString()} tris`}</span>
              <span title="Bounding box dimensions (W x H x D)">
                {`${formatDimension(modelInfo.bounds.size[0])} x ${formatDimension(modelInfo.bounds.size[1])} x ${formatDimension(modelInfo.bounds.size[2])}`}
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

Preview.register({
  id: '3d-viewer',
  title: '3D Model Viewer',
  description: 'View STL and OBJ 3D models with rotation and zoom',
  icon: 'box',
  permissions: ['files:read'],

  canPreview: (file) => !file.is_dir && isModelFile(file.path),
  priority: 10,

  onActivate: (injectedApi) => { api = injectedApi; },

  render: (props) => {
    const selectedFiles = (props.selectedFiles || []) as FileEntry[];
    const modelFile = selectedFiles.find(f => isModelFile(f.path));

    if (!modelFile) {
      return (
        <div style={{
          padding: 24, color: 'var(--xp-text-muted, #888)', fontSize: 13,
          textAlign: 'center' as const, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 12,
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          Select an STL or OBJ file to preview
        </div>
      );
    }

    return <ModelViewer filePath={modelFile.path} />;
  },
});
