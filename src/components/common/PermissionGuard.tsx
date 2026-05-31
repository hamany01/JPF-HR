import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { RolePermissions, VisibilityType } from '../../types/permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  field?: keyof RolePermissions['fields'];
  requiredVisibility?: VisibilityType;
  action?: keyof RolePermissions['actions'];
}

export default function PermissionGuard({
  children,
  fallback = null,
  field,
  requiredVisibility = 'full',
  action,
}: PermissionGuardProps) {
  const { getFieldVisibility, canDo } = usePermissions();

  if (action) {
    const hasAction = canDo(action);
    if (!hasAction) {
      return <>{fallback}</>;
    }
  }

  if (field) {
    const visibility = getFieldVisibility(field);

    if (requiredVisibility === 'full') {
      if (visibility !== 'full') {
        return <>{fallback}</>;
      }
    } else if (requiredVisibility === 'masked') {
      if (visibility === 'hidden') {
        return <>{fallback}</>;
      }
    }
  }

  return <>{children}</>;
}
