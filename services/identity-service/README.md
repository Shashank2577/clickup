# Identity Service

The source of truth for user accounts, workspace hierarchies, and permissions.

## 🚀 Key Features

- **Authentication**: JWT-based login, registration, and session management.
- **Hierarchical Structure**: Manages Workspaces, Spaces, Folders, and Lists.
- **Access Control**: Handles workspace membership, roles, and resource-level permissions.
- **User Profiles**: Custom preferences, themes, and avatars.
- **Third-party Auth**: Ready for OAuth (Google/GitHub) and SSO/SAML integration.
- **Developer Tools**: API key management and scoped service tokens.

## 🏗️ Domain Models

- **User**: Core account data.
- **Workspace**: The top-level container for all work.
- **Member**: Linking Users to Workspaces with specific roles (Owner, Admin, Member, Guest).
- **Space/Folder/List**: The organizational hierarchy.
- **Preference**: Per-user configuration.

## 🔌 API Endpoints

- `POST /auth/login`: Standard authentication.
- `GET /users/me`: Current user context.
- `GET /workspaces/:id/members`: Team management.
- `POST /workspaces/:id/invites`: Invite flow.
- `GET /command-palette`: Quick navigation search.

## 🛠️ Tech Stack

- **Node.js / Express**
- **PostgreSQL**: Primary data store.
- **bcrypt**: Password hashing.
- **jsonwebtoken**: Token issuance and verification.
