import { UserRole } from './user';

export type VisibilityType = 'full' | 'masked' | 'hidden';

export interface RolePermissions {
  role: UserRole;
  label: string;
  fields: {
    serialNumber: VisibilityType;
    clientName: VisibilityType;
    nationalId: VisibilityType;
    financialAmounts: VisibilityType;
    attachments: VisibilityType;
    sessionsInfo: VisibilityType;
  };
  actions: {
    createRequest: boolean;
    editRequest: boolean;
    deleteRequest: boolean;
    addNote: boolean;
    deleteNote: boolean;
    assignEmployee?: boolean;
  };
  updatedAt?: any;
}
