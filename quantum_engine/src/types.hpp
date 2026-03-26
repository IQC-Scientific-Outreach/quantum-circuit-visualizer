#pragma once
#include <complex>
#include <vector>
#include <array>
#include <string>

using namespace std;
using Complex = complex<double>;
using Matrix2x2 = array<Complex, 4>;

struct Instruction {
    string name;
    vector<int> qubits;
};