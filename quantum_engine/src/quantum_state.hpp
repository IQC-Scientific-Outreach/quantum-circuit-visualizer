#pragma once
#include "types.hpp"
using namespace std;

class QuantumState {
private:
    int num_qubits;
    vector<Complex> state;

public:
    QuantumState(int n);
    void apply_1q_gate(const Matrix2x2& matrix, int target_qubit);
    void apply_cnot(int control, int target);
    const vector<Complex>& get_state() const;
};