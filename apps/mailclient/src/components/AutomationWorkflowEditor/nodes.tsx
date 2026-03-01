'use client';

import { Handle, Position, NodeTypes } from '@xyflow/react';
import {
  FiPlay,
  FiSend,
  FiFilter,
  FiTag,
  FiZap,
  FiStar,
  FiX,
  FiSettings,
  FiBriefcase,
  FiCheckCircle,
  FiMail,
} from 'react-icons/fi';

export const CONDITION_FIELD_LABELS: Record<string, string> = {
  subject: 'Betreff',
  from: 'Von',
  to: 'An',
  body: 'Inhalt',
  type: 'Typ',
  phone_number: 'Telefonnummer',
  urgency: 'Dringlichkeit',
  themeId: 'Thema',
  theme: 'Thema',
  read: 'Lesestatus',
  completed: 'Erledigt-Status',
  hasAttachment: 'Anhang',
};

export const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  contains: 'enthält',
  equals: 'gleich',
  is: 'ist',
  startsWith: 'beginnt mit',
  endsWith: 'endet mit',
  notContains: 'enthält nicht',
  isEmpty: 'ist leer',
  isNotEmpty: 'ist nicht leer',
  notEquals: 'ungleich',
  matchesRegex: 'RegEx',
};

export function StartNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: selected ? '#e7f3ff' : 'white',
        border: selected ? '2px solid #007bff' : '2px solid #007bff',
        borderRadius: '8px',
        minWidth: '180px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: '#007bff', width: '10px', height: '10px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FiPlay style={{ color: '#007bff' }} />
        <strong>{data.label || 'Start'}</strong>
      </div>
    </div>
  );
}

export function ConditionNode({ data, selected }: { data: any; selected: boolean }) {
  const conditions = Array.isArray(data.conditions) ? data.conditions : null;
  const combineMode = data.combineMode || 'and';
  const hasMultiple = conditions && conditions.length > 0;

  const summary = hasMultiple
    ? `${conditions.length} Bedingung${conditions.length !== 1 ? 'en' : ''} (${combineMode === 'and' ? 'AND' : 'OR'})`
    : data.field && data.operator
      ? [
          CONDITION_FIELD_LABELS[data.field] || data.field,
          CONDITION_OPERATOR_LABELS[data.operator] || data.operator,
          (data.operator === 'isEmpty' || data.operator === 'isNotEmpty') ? '' : (data.value || '…'),
        ].filter(Boolean).join(' ')
      : null;

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: selected ? '#fff3cd' : 'white',
        border: selected ? '2px solid #ffc107' : '2px solid #ffc107',
        borderRadius: '8px',
        minWidth: '200px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#ffc107', width: '10px', height: '10px' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#ffc107', width: '10px', height: '10px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <FiFilter style={{ color: '#ffc107' }} />
        <strong>{data.label || 'Bedingung'}</strong>
      </div>
      {summary && (
        <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>
          {summary}
        </div>
      )}
    </div>
  );
}

export function ActionNode({ data, selected }: { data: any; selected: boolean }) {
  const getIcon = () => {
    if (data.actionType === 'set_theme' || data.type === 'setThemeAction') return <FiTag style={{ color: '#28a745' }} />;
    if (data.actionType === 'set_urgency' || data.type === 'setUrgencyAction') return <FiZap style={{ color: '#ffc107' }} />;
    if (data.actionType === 'mark_important' || data.type === 'markImportantAction') return <FiStar style={{ color: '#ffc107' }} />;
    if (data.actionType === 'mark_spam' || data.type === 'markSpamAction') return <FiX style={{ color: '#dc3545' }} />;
    if (data.actionType === 'forward' || data.type === 'forwardEmailAction') return <FiSend style={{ color: '#17a2b8' }} />;
    if (data.actionType === 'assign_department' || data.type === 'assignDepartmentAction') return <FiBriefcase style={{ color: '#6f42c1' }} />;
    if (data.actionType === 'mark_completed' || data.type === 'markCompletedAction') return <FiCheckCircle style={{ color: '#28a745' }} />;
    if (data.actionType === 'mark_uncompleted' || data.type === 'markUncompletedAction') return <FiCheckCircle style={{ color: '#6c757d' }} />;
    if (data.actionType === 'mark_read' || data.type === 'markReadAction') return <FiMail style={{ color: '#17a2b8' }} />;
    if (data.actionType === 'mark_unread' || data.type === 'markUnreadAction') return <FiMail style={{ color: '#6c757d' }} />;
    if (data.actionType === 'mark_read_and_completed' || data.type === 'markReadAndCompletedAction') return <FiCheckCircle style={{ color: '#28a745' }} />;
    return <FiSettings style={{ color: '#28a745' }} />;
  };

  const getColor = () => {
    if (data.actionType === 'set_theme' || data.type === 'setThemeAction') return '#28a745';
    if (data.actionType === 'set_urgency' || data.type === 'setUrgencyAction') return '#ffc107';
    if (data.actionType === 'mark_important' || data.type === 'markImportantAction') return '#ffc107';
    if (data.actionType === 'mark_spam' || data.type === 'markSpamAction') return '#dc3545';
    if (data.actionType === 'forward' || data.type === 'forwardEmailAction') return '#17a2b8';
    if (data.actionType === 'assign_department' || data.type === 'assignDepartmentAction') return '#6f42c1';
    if (data.actionType === 'mark_completed' || data.type === 'markCompletedAction') return '#28a745';
    if (data.actionType === 'mark_uncompleted' || data.type === 'markUncompletedAction') return '#6c757d';
    if (data.actionType === 'mark_read' || data.type === 'markReadAction') return '#17a2b8';
    if (data.actionType === 'mark_unread' || data.type === 'markUnreadAction') return '#6c757d';
    if (data.actionType === 'mark_read_and_completed' || data.type === 'markReadAndCompletedAction') return '#28a745';
    return '#28a745';
  };

  const getActionLabel = (): string => {
    if (data.actionType === 'assign_department' || data.type === 'assignDepartmentAction') {
      return data.departmentName ? `Abteilung zuweisen: ${data.departmentName}` : 'Abteilung zuweisen';
    }
    return data.label || 'Aktion';
  };

  const color = getColor();

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: selected ? `${color}15` : 'white',
        border: selected ? `2px solid ${color}` : `2px solid ${color}`,
        borderRadius: '8px',
        minWidth: '180px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: '10px', height: '10px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {getIcon()}
        <strong>{getActionLabel()}</strong>
      </div>
      {data.themeName && <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Thema: {data.themeName}</div>}
      {data.urgency && <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Dringlichkeit: {data.urgency}</div>}
      {data.to && <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>An: {data.to}</div>}
      {(data.actionType === 'assign_department' || data.type === 'assignDepartmentAction') && data.departmentName && (
        <div style={{ fontSize: '0.875rem', color: '#6c757d' }}>Abteilung: {data.departmentName}</div>
      )}
    </div>
  );
}

export function DepartmentNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: selected ? '#e7f3ff' : 'white',
        border: selected ? '2px solid #17a2b8' : '2px solid #17a2b8',
        borderRadius: '8px',
        minWidth: '180px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#17a2b8', width: '10px', height: '10px' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#17a2b8', width: '10px', height: '10px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <FiBriefcase style={{ color: '#17a2b8' }} />
        <strong>{data.departmentName || data.label || 'Abteilung'}</strong>
      </div>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  startNode: StartNode,
  conditionNode: ConditionNode,
  actionNode: ActionNode,
  departmentNode: DepartmentNode,
};
