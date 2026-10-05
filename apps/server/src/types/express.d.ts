import type { WorkspaceDoc } from '../models/Workspace.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: { id: string; name: string };
      workspace?: WorkspaceDoc;
    }
  }
}

export {};
