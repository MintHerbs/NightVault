import { useMemo } from 'react';
import { displayComplexity, colorForComplexity } from '../../../../lib/algo/complexityTypes.js';
import styles from './ComplexityCodeView.module.css';

const LINE_HEIGHT = 22;
const BRACKET_COL_WIDTH = 88;
const BASE_OFFSET = 8;

export default function ComplexityCodeView({ code, annotations }) {
  const lines = useMemo(() => code.split('\n'), [code]);
  
  const { maxDepth, sortedAnnotations, svgWidth, svgHeight, lineColorMap } = useMemo(() => {
    if (!annotations || annotations.length === 0) {
      return { 
        maxDepth: 0, 
        sortedAnnotations: [], 
        svgWidth: 0, 
        svgHeight: lines.length * LINE_HEIGHT,
        lineColorMap: {}
      };
    }
    
    const maxDepth = Math.max(...annotations.map(a => a.depth));
    
    // Sort deepest-first so outermost draws on top
    const sortedAnnotations = [...annotations].sort((a, b) => b.depth - a.depth);
    
    const svgWidth = (maxDepth + 1) * BRACKET_COL_WIDTH + 16;
    const svgHeight = lines.length * LINE_HEIGHT;
    
    // Build line color map - each line gets the color of its deepest annotation
    const lineColorMap = {};
    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      // Find all annotations covering this line
      const coveringAnnotations = annotations.filter(
        ann => lineNum >= ann.lineStart && lineNum <= ann.lineEnd
      );
      
      if (coveringAnnotations.length > 0) {
        // Pick the one with highest depth (most specific)
        const deepest = coveringAnnotations.reduce((max, ann) => 
          ann.depth > max.depth ? ann : max
        );
        lineColorMap[lineNum] = colorForComplexity(deepest.complexity) || '#e2e8f0';
      } else {
        lineColorMap[lineNum] = '#e2e8f0';
      }
    }
    
    return { maxDepth, sortedAnnotations, svgWidth, svgHeight, lineColorMap };
  }, [annotations, lines.length]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>CODE</span>
      </div>
      
      <div className={styles.scrollContainer}>
        <div className={styles.content}>
          {/* Code lines section */}
          <div className={styles.codeSection}>
            {lines.map((line, idx) => (
              <div key={idx} className={styles.line}>
                <span className={styles.lineNumber}>{idx + 1}</span>
                <span 
                  className={styles.lineText}
                  style={{ color: lineColorMap[idx + 1] ?? '#e2e8f0' }}
                >
                  {line}
                </span>
              </div>
            ))}
          </div>
          
          {/* Annotation panel with SVG brackets */}
          {annotations && annotations.length > 0 && (
            <div className={styles.annotationPanel}>
              <svg
                width={svgWidth}
                height={svgHeight}
                className={styles.svg}
              >
                {sortedAnnotations.map((ann, idx) => {
                  const color = colorForComplexity(ann.complexity) || '#6b7280';
                  
                  // Calculate positions
                  const x = (maxDepth - ann.depth) * BRACKET_COL_WIDTH + BASE_OFFSET;
                  const yTop = (ann.lineStart - 1) * LINE_HEIGHT + 11;
                  const yBot = (ann.lineEnd - 1) * LINE_HEIGHT + 11;
                  const yMid = (yTop + yBot) / 2;
                  
                  const label = displayComplexity(ann.complexity);
                  const labelRectWidth = BRACKET_COL_WIDTH - 16; // 72px
                  
                  return (
                    <g key={`${ann.id}-${idx}`}>
                      {/* Hover explanation: how this group's complexity was derived */}
                      {ann.label && <title>{ann.label}</title>}

                      {/* Vertical line */}
                      <line
                        x1={x}
                        y1={yTop}
                        x2={x}
                        y2={yBot}
                        stroke={color}
                        strokeWidth="2"
                      />
                      
                      {/* Top tick */}
                      <line
                        x1={x}
                        y1={yTop}
                        x2={x + 6}
                        y2={yTop}
                        stroke={color}
                        strokeWidth="2"
                      />
                      
                      {/* Bottom tick */}
                      <line
                        x1={x}
                        y1={yBot}
                        x2={x + 6}
                        y2={yBot}
                        stroke={color}
                        strokeWidth="2"
                      />
                      
                      {/* Label background rect */}
                      <rect
                        x={x + 10}
                        y={yMid - 9}
                        width={labelRectWidth}
                        height={18}
                        rx={4}
                        fill={color}
                        fillOpacity={0.15}
                      />
                      
                      {/* Label text */}
                      <text
                        x={x + 14}
                        y={yMid + 4}
                        fill={color}
                        fontSize="11"
                        fontFamily="'JetBrains Mono', monospace"
                        fontWeight="500"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
