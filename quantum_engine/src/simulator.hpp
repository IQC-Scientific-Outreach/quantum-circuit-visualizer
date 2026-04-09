#pragma once
#include <cmath>
#include "types.hpp"
#include "quantum_state.hpp"
#include "gate_registry.hpp"
using namespace std;

class Simulator {
private:
    int num_qubits;
    QuantumState q_state;
    vector<int> classical_bits;  // -1 = unmeasured, 0/1 = measured outcome
    double get_expectation_arbitrary(int target_qubit, const Matrix2x2& matrix) const;

public:
    Simulator(int num_qubits);
    void run(const vector<Instruction>& circuit);
    vector<double> get_probabilities() const;
    vector<double> get_statevector() const;
    double get_expectation_z(int target_qubit) const;
    double get_expectation_y(int target_qubit) const;
    double get_expectation_x(int target_qubit) const;
    vector<int> get_classical_bits() const;
};
