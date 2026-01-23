'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  ExecutionType,
  EditableFieldConfig,
  getEditableFields,
} from '@/server/actions/types';

interface DraftEditorProps {
  executionType: ExecutionType;
  payload: Record<string, unknown>;
  onSave: (updatedPayload: Record<string, unknown>) => Promise<void>;
  isSaving?: boolean;
}

export function DraftEditor({
  executionType,
  payload,
  onSave,
  isSaving = false,
}: DraftEditorProps) {
  const [editedPayload, setEditedPayload] = useState<Record<string, unknown>>(payload);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const editableFields = getEditableFields(executionType);

  const handleFieldChange = (path: string, value: unknown) => {
    setEditedPayload((prev) => ({
      ...prev,
      [path]: value,
    }));
    setHasChanges(true);
    // Clear error for this field
    if (errors[path]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    }
  };

  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};

    editableFields.forEach((field) => {
      if (field.required && !editedPayload[field.path]) {
        newErrors[field.path] = `${field.label} is required`;
      }

      if (field.validation && editedPayload[field.path] !== undefined) {
        try {
          field.validation.parse(editedPayload[field.path]);
        } catch (error: unknown) {
          const zodError = error as { errors?: Array<{ message: string }> };
          newErrors[field.path] = zodError.errors?.[0]?.message || 'Invalid value';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateFields()) {
      return;
    }

    await onSave(editedPayload);
    setHasChanges(false);
  };

  return (
    <Card>
      <div className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Edit Draft</h3>
          <p className="text-sm text-muted-foreground">
            Review and modify the action details before approval
          </p>
        </div>

        <div className="space-y-4">
          {editableFields.map((field) => (
            <FieldEditor
              key={field.path}
              field={field}
              value={editedPayload[field.path]}
              onChange={(value) => handleFieldChange(field.path, value)}
              error={errors[field.path]}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            {hasChanges ? 'You have unsaved changes' : 'No changes'}
          </p>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface FieldEditorProps {
  field: EditableFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}

function FieldEditor({ field, value, onChange, error }: FieldEditorProps) {
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <Input
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            error={error}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => onChange(Number(e.target.value))}
            error={error}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        </div>
      );

    case 'date':
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <Input
            type="datetime-local"
            value={value ? new Date(value as string | number).toISOString().slice(0, 16) : ''}
            onChange={(e) => onChange(new Date(e.target.value).toISOString())}
            error={error}
          />
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-calm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={(value as boolean) || false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <label className="text-sm font-medium text-foreground">
            {field.label}
          </label>
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {field.label}
            {field.required && <span className="text-error ml-1">*</span>}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-calm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      );

    default:
      return null;
  }
}
