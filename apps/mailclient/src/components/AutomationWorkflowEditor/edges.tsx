'use client';

import { useState } from 'react';
import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react';

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  onDelete,
}: EdgeProps & { onDelete?: (id: string) => void }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: selected ? '#007bff' : style.stroke || '#b1b1b7',
          strokeWidth: selected ? 3 : style.strokeWidth || 2,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {(isHovered || selected) && onDelete && (
        <g>
          <circle
            cx={labelX}
            cy={labelY}
            r={12}
            fill="white"
            stroke="#dc3545"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.fill = '#dc3545';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.fill = 'white';
            }}
          />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ pointerEvents: 'none', fontSize: '12px', fill: '#dc3545', fontWeight: 'bold' }}
          >
            ×
          </text>
        </g>
      )}
    </>
  );
}
