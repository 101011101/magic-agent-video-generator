# Prod

- Production code for the new system.
- [state-manager/](state-manager/README.md): prototype of the state manager and solver (steps 3–5 of the pipeline).
- [test-machine/](test-machine/README.md): supervised pipeline runs — the real pipeline stopped at every major step and every paid call until you approve it in a browser page (`--supervised`).
- [sweeps/](sweeps/README.md): model comparisons that hold everything constant except the model (RUN-001 image-model cost sweep).
- Specs: [../docs/](../docs/architecture.md). Tests and fixtures: [../tests/](../tests/README.md).
