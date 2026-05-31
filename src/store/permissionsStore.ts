import { create } from 'zustand';
import { collection, doc, getDocs, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { RolePermissions, VisibilityType } from '../types/permissions';
import { UserRole } from '../types/user';

// القيم الافتراضية لكل دور في حال عدم توفر مستند الصلاحيات في قاعدة البيانات
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    label: 'المدير العام (مسؤول النظام)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: true,
      addNote: true,
      deleteNote: true,
      assignEmployee: true,
    },
  },
  law_manager: {
    role: 'law_manager',
    label: 'المحامي العام (مدير الشؤون القانونية)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: true,
      assignEmployee: true,
    },
  },
  law_assistant: {
    role: 'law_assistant',
    label: 'مساعد الشؤون القانونية',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: false,
      assignEmployee: false,
    },
  },
  company_manager: {
    role: 'company_manager',
    label: 'مدير الشركة (صاحب العمل)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'full',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: true,
      assignEmployee: true,
    },
  },
  company_assistant: {
    role: 'company_assistant',
    label: 'مساعد الشركة',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'full',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: true,
      editRequest: true,
      deleteRequest: false,
      addNote: true,
      deleteNote: false,
      assignEmployee: false,
    },
  },
  employee: {
    role: 'employee',
    label: 'موظف (صلاحيات محدودة)',
    fields: {
      serialNumber: 'full',
      clientName: 'full',
      nationalId: 'masked',
      financialAmounts: 'hidden',
      attachments: 'full',
      sessionsInfo: 'full',
    },
    actions: {
      createRequest: false,
      editRequest: false,
      deleteRequest: false,
      addNote: true,
      deleteNote: false,
      assignEmployee: false,
    },
  },
};

interface PermissionsState {
  permissions: Record<UserRole, RolePermissions> | null;
  loading: boolean;
  error: string | null;
  // أفعال
  initStoreListener: () => () => void; // دالة الاشتراك الفوري وترجع دالة إلغاء الاشتراك
  updateRolePermissionValue: (
    role: UserRole,
    type: 'fields' | 'actions',
    key: string,
    value: any
  ) => Promise<void>;
  saveRolePermissions: (role: UserRole, data: RolePermissions) => Promise<void>;
  resetToDefaults: (role: UserRole) => Promise<void>;
}

// محاولة جلب الصلاحيات المخزنة محلياً لتفادي الوميض (Blank Layout/Flash)
const getCachedPermissions = (): Record<UserRole, RolePermissions> | null => {
  try {
    const cached = localStorage.getItem('jpf_cached_permissions');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Failed to parse cached permissions:", err);
  }
  return null;
};

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: getCachedPermissions() || DEFAULT_ROLE_PERMISSIONS,
  loading: true,
  error: null,

  /**
   * دالة تأسيس المستمع اللحظي (onSnapshot) مع Firestore لضمان تحديث الصلاحيات
   * فوراً للمستخدمين النشطين دون الحاجة لتحديث الصفحة.
   */
  initStoreListener: () => {
    set({ loading: true });
    
    const unsubscribe = onSnapshot(
      collection(db, 'roles_permissions'),
      (snapshot) => {
        const mergedPermissions = { ...DEFAULT_ROLE_PERMISSIONS } as Record<UserRole, RolePermissions>;
        
        snapshot.forEach((doc) => {
          const roleId = doc.id as UserRole;
          if (DEFAULT_ROLE_PERMISSIONS[roleId]) {
            mergedPermissions[roleId] = {
              ...DEFAULT_ROLE_PERMISSIONS[roleId],
              ...doc.data(),
              role: roleId,
            } as RolePermissions;
          }
        });

        // تم الحفظ في الحالة والتخزين المؤقت المحلي للتسريع مستقبلاً
        localStorage.setItem('jpf_cached_permissions', JSON.stringify(mergedPermissions));
        set({ permissions: mergedPermissions, loading: false, error: null });
      },
      (err) => {
        console.error("Error listening to roles_permissions:", err);
        set({ error: err.message, loading: false });
      }
    );

    return unsubscribe;
  },

  /**
   * تحديث حقل صلاحية معين لدور محدد مباشرة في Firestore وقاعدة البيانات
   */
  updateRolePermissionValue: async (role, type, key, value) => {
    const current = get().permissions;
    if (!current) return;

    const roleData = { ...current[role] };
    if (type === 'fields') {
      roleData.fields = {
        ...roleData.fields,
        [key]: value as VisibilityType
      };
    } else {
      roleData.actions = {
        ...roleData.actions,
        [key]: value as boolean
      };
    }

    try {
      const docRef = doc(db, 'roles_permissions', role);
      await setDoc(docRef, {
        fields: roleData.fields,
        actions: roleData.actions,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      console.error(`Failed to update role permission for ${role}:`, err);
      set({ error: err.message });
      throw err;
    }
  },

  /**
   * حفظ مستند الصلاحيات الكامل لدور محدد في Firestore
   */
  saveRolePermissions: async (role, data) => {
    try {
      const docRef = doc(db, 'roles_permissions', role);
      await setDoc(docRef, {
        fields: data.fields,
        actions: data.actions,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      console.error(`Failed to save role permissions for ${role}:`, err);
      set({ error: err.message });
      throw err;
    }
  },

  /**
   * استعادة القيم الافتراضية المخصصة لدور محدد
   */
  resetToDefaults: async (role) => {
    const defaultData = DEFAULT_ROLE_PERMISSIONS[role];
    if (!defaultData) return;
    await get().saveRolePermissions(role, defaultData);
  }
}));
