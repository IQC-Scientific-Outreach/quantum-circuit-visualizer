#!/bin/bash

mkdir -p dist

echo "Compiling C++ Math Engine to WebAssembly..."

emcc src/gate_registry.cpp src/quantum_state.cpp src/simulator.cpp src/wasm_bindings.cpp \
  -I src \
  -O3 \
  -lembind \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s ENVIRONMENT=web \
  -o dist/quantum_engine.js

echo "Build complete! Output saved to dist/quantum_engine.js and dist/quantum_engine.wasm"