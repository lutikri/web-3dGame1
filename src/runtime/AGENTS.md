# Runtime Layer

- Runtime loading is exclusive: one menu-preview or active environment owns scene instances, physics bodies, lights, interactions, and temporary state.
- Source assets may stay cached; level instances and physics state may not survive an environment transition.
- Every runtime resource must be registered with one owner and disposed exactly once, preferably in reverse ownership order.
- Rapid route requests use latest-request-wins semantics. Never allow a stale load to become active.
- Lifecycle changes require unit tests and the `?runtimeSmoke=1` browser route.
