# Diagrams

The diagrams are written in Mermaid inside the Markdown documents (GitHub renders them, and they stay version-controlled as text). The PNGs here are rendered copies for reports and slides. **Edit the Mermaid source, not the PNG**, then re-render:

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o diagram.png -s 2
```

| File | Source |
|---|---|
| 01-as-is-process | `01-discovery/as-is-analysis.md` |
| 02 … 05 (use case, DFD 0/1, domain model) | `03-analysis.md` |
| 06 … 14 (layers, modules, sequences, state machines) | `04-design.md` |
| 15, 16 (component, deployment) | `05-architecture.md` |
| 17 test levels | `06-test-plan.md` |
| 18 change control | `08-configuration-and-change-management.md` |
| 19 ER diagram | `database.md` |

`screens/` holds screenshots of the running v1.0 UI (student, scanner, manager, committee, mobile), captured by the automated browser smoke test.
