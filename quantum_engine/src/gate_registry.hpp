#pragma once
#include "types.hpp"
#include <unordered_map>
#include <string>
using namespace std;

namespace GateRegistry {
    extern const unordered_map<string, Matrix2x2> base_gates;
}