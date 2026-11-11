# Task-based navigation

The owner selected option A: five primary destinations (Home, Sessions, Assistants, Connections, Settings), persistent left navigation and one destination for each configuration task. Preserve existing capabilities, blue/white identity and localized labels.

- Home starts/resumes work and directs incomplete setup to its relevant settings section.
- Sessions contains history and the active conversation. The floating bar/panel remain separate native surfaces of that same session.
- Assistants selects/edits instructions. Provider/model configuration belongs to Settings → AI.
- Connections groups Apps & notes, Agents & reviews, and Advanced MCP. Existing connectors, client installers, pending reviews, history access, manual servers, vault discovery and three MCP prompt editors remain available once each.
- Settings groups General, Audio & screen, AI & models, Behavior, Privacy, Permissions, Shortcuts, Data & email. General retains language/appearance; Data retains email configuration and confirmed history deletion. Technical behavior tuning is progressively disclosed. Privacy uses the fuller existing page and keeps the previous Zoom instructions.

Main navigation stays visible inside Settings. Breadcrumbs, current-link semantics and explanatory headings identify the location. Legacy UI/native deep links resolve through a tested pure route mapping; provider identifiers are preserved. No backend/native endpoint, dependency or integration capability changes.

## SOLID check

Navigation metadata/route normalization is a dependency-free module with focused tests. Shell rendering, connection composition and settings composition remain separate. Existing feature components retain their API contracts. AI sources no longer imports the settings root type. Shared layout styles and feature content do not duplicate business logic or persistence.
