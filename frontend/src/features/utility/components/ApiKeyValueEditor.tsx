import type { ApiWorkspaceKeyValue } from "@/features/utility/types/apiWorkspaceTypes";
import { createEmptyKeyValue } from "@/features/utility/utils/apiWorkspaceUtils";

interface ApiKeyValueEditorProps {
  entries: ApiWorkspaceKeyValue[];
  keyLabel: string;
  valueLabel: string;
  emptyMessage: string;
  onChange: (entries: ApiWorkspaceKeyValue[]) => void;
}

export const ApiKeyValueEditor = ({
  entries,
  keyLabel,
  valueLabel,
  emptyMessage,
  onChange,
}: ApiKeyValueEditorProps) => {
  const updateEntry = (entryId: string, changes: Partial<ApiWorkspaceKeyValue>): void => {
    onChange(entries.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry)));
  };

  const removeEntry = (entryId: string): void => {
    const remainingEntries = entries.filter((entry) => entry.id !== entryId);
    onChange(remainingEntries.length > 0 ? remainingEntries : [createEmptyKeyValue()]);
  };

  return (
    <div className="api-key-value-editor">
      <div className="api-grid-heading" aria-hidden="true">
        <span>사용</span><span>{keyLabel}</span><span>{valueLabel}</span><span>삭제</span>
      </div>
      {entries.length === 0 ? <p className="api-empty-copy">{emptyMessage}</p> : null}
      {entries.map((entry, entryIndex) => (
        <div className="api-key-value-row" key={entry.id}>
          <input
            type="checkbox"
            checked={entry.enabled}
            aria-label={`${entryIndex + 1}번째 항목 사용`}
            onChange={(event) => updateEntry(entry.id, { enabled: event.target.checked })}
          />
          <input
            value={entry.key}
            aria-label={`${entryIndex + 1}번째 ${keyLabel}`}
            placeholder={keyLabel}
            onChange={(event) => updateEntry(entry.id, { key: event.target.value })}
          />
          <input
            type={entry.secret ? "password" : "text"}
            value={entry.value}
            aria-label={`${entryIndex + 1}번째 ${valueLabel}`}
            placeholder={valueLabel}
            onChange={(event) => updateEntry(entry.id, { value: event.target.value })}
          />
          <button type="button" className="api-icon-button" aria-label={`${entryIndex + 1}번째 항목 삭제`} onClick={() => removeEntry(entry.id)}>×</button>
        </div>
      ))}
      <button type="button" className="ghost-button api-add-row-button" onClick={() => onChange([...entries, createEmptyKeyValue()])}>+ 항목 추가</button>
    </div>
  );
};
